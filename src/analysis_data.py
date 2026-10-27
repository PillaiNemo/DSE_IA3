"""Exploring the data: Modules 2, 3 and 4 (regression and clustering).

Descriptive statistics, group/filter/sort, plots, confidence interval, t-test,
chi-square test, family/background factors (group rates + chi-square),
multiple vs polynomial regression, K-means and agglomerative clustering.
Run:  python src/analysis_data.py
Saves figures to reports/figures/ and numbers to reports/results.json
"""
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from scipy import stats  # noqa: E402
from scipy.cluster.hierarchy import dendrogram, linkage  # noqa: E402
from sklearn.cluster import KMeans  # noqa: E402
from sklearn.linear_model import LinearRegression  # noqa: E402
from sklearn.metrics import mean_squared_error, r2_score, silhouette_score  # noqa
from sklearn.model_selection import train_test_split  # noqa: E402
from sklearn.pipeline import make_pipeline  # noqa: E402
from sklearn.preprocessing import PolynomialFeatures, StandardScaler  # noqa

sys.path.append(str(Path(__file__).resolve().parent))
from data_utils import (BACKGROUND, COURSES, RANDOM_STATE, REPORT_DIR,  # noqa
                        background_group, load_data, save_results)

FIG = REPORT_DIR / "figures"
S1A, S1G = "Curricular units 1st sem (approved)", "Curricular units 1st sem (grade)"
S2A, S2G = "Curricular units 2nd sem (approved)", "Curricular units 2nd sem (grade)"
INK, ACC = "#1c1b19", "#e4572e"


def save(name):
    plt.tight_layout()
    plt.savefig(FIG / name, dpi=150)
    plt.close()


def rate_by(df, col, labels):
    """Dropout rate for each value of a column (group + mean)."""
    rates = df.groupby(col)["Dropout"].mean()
    return {labels[k]: round(float(v), 4) for k, v in rates.items()}


def explore(df):
    """Module 2/3: shape, missing values, groups, statistics and plots."""
    cols = ["Age at enrollment", "Admission grade", S1A, S1G, S2G]
    desc = df[cols].agg(["mean", "median", "var", "std"]).T.round(2)
    print(desc)
    units = df[S1A].clip(upper=10)
    by_units = df.groupby(units)["Dropout"].mean().round(4)

    # Histogram: semester-1 subjects passed, dropouts vs others.
    plt.figure(figsize=(6.5, 3.8))
    plt.hist([df.loc[df.Dropout == 0, S1A], df.loc[df.Dropout == 1, S1A]], bins=20,
             color=[INK, ACC], label=["Not dropout", "Dropout"])
    plt.xlabel("Semester-1 subjects passed")
    plt.ylabel("Students")
    plt.legend()
    save("eda_histogram_units.png")

    # Box plot: admission grade by final outcome.
    order = ["Dropout", "Enrolled", "Graduate"]
    plt.figure(figsize=(6, 3.8))
    plt.boxplot([df.loc[df.Target == t, "Admission grade"] for t in order],
                tick_labels=order)
    plt.ylabel("Admission grade (/200)")
    save("eda_boxplot_admission.png")

    # Count plot: outcomes.
    counts = df["Target"].value_counts().reindex(order)
    plt.figure(figsize=(5.5, 3.5))
    plt.bar(counts.index, counts.values, color=[ACC, "#b9b5ab", INK])
    plt.ylabel("Students")
    save("eda_count_outcomes.png")

    # Correlation heatmap of the 10 columns most related to dropout.
    corr_all = df.select_dtypes("number").corr()["Dropout"].drop("Dropout")
    top10 = corr_all.abs().sort_values(ascending=False).index[:10].tolist()
    corr = df[top10 + ["Dropout"]].corr()
    plt.figure(figsize=(8, 6.5))
    plt.imshow(corr, cmap="RdGy_r", vmin=-1, vmax=1)
    plt.colorbar(shrink=.8)
    short = [c.replace("Curricular units ", "").replace(" sem", "") for c in corr]
    plt.xticks(range(len(corr)), short, rotation=90, fontsize=7)
    plt.yticks(range(len(corr)), short, fontsize=7)
    save("eda_correlation_heatmap.png")

    top8 = corr_all.reindex(corr_all.abs().sort_values(ascending=False).index)[:8]
    return {"rows": len(df), "features": df.shape[1] - 2,
            "missing": int(df.isna().sum().sum()),
            "targets": df["Target"].value_counts().to_dict(),
            "dropout_rate": round(df["Dropout"].mean(), 4),
            "descriptive": desc.to_dict(),
            "by_units": {int(k): float(v) for k, v in by_units.items()},
            "by_fees": rate_by(df, "Tuition fees up to date", {0: "Not paid", 1: "Paid"}),
            "by_debtor": rate_by(df, "Debtor", {0: "No", 1: "Yes"}),
            "by_scholarship": rate_by(df, "Scholarship holder", {0: "No", 1: "Yes"}),
            "by_gender": rate_by(df, "Gender", {0: "Female", 1: "Male"}),
            "correlation": top8.round(3).to_dict()}


def inference(df):
    """Module 3: 95% confidence interval, t-test and chi-square test."""
    p, n = df["Dropout"].mean(), len(df)
    half = 1.96 * np.sqrt(p * (1 - p) / n)
    t, pt = stats.ttest_ind(df.loc[df.Dropout == 1, S1A],
                            df.loc[df.Dropout == 0, S1A], equal_var=False)
    chi2, pc, dof, _ = stats.chi2_contingency(
        pd.crosstab(df["Scholarship holder"], df["Dropout"]))
    print(f"95% CI dropout rate: [{p - half:.4f}, {p + half:.4f}]")
    print(f"t-test sem-1 passed: t={t:.2f}, p={pt:.2g}; chi-square scholarship: "
          f"chi2={chi2:.1f}, p={pc:.2g}")
    return {"ci": [round(p - half, 4), round(p + half, 4)], "t": round(t, 2),
            "t_p": f"{pt:.1e}", "chi2": round(chi2, 1), "chi2_dof": int(dof),
            "chi2_p": f"{pc:.1e}"}


AGE_BINS, AGE_LABELS = [0, 19, 24, 34, 200], ["17-19", "20-24", "25-34", "35+"]


def group_test(df, groups):
    """Chi-square test of independence (group vs Dropout) and Cramer's V.

    Groups with fewer than 20 students are left out of the test, because
    chi-square needs expected counts of about 5 or more in every cell.
    """
    keep = groups.map(groups.value_counts()) >= 20
    table = pd.crosstab(groups[keep], df.loc[keep, "Dropout"])
    chi2, p, dof, _ = stats.chi2_contingency(table)
    return {"chi2": round(chi2, 1), "dof": int(dof), "p": f"{p:.1e}",
            "significant": bool(p < 0.05),
            "cramers_v": round(float(np.sqrt(chi2 / table.values.sum())), 3)}


def background(df):
    """Family and background factors: dropout rate per group + chi-square test."""
    out = {}
    for col, defs in BACKGROUND.items():
        groups = df[col].map(lambda c: background_group(col, c))
        rates = df.groupby(groups)["Dropout"].agg(["size", "mean"])
        out[col] = {"groups": [{"label": label, "codes": codes,
                                "n": int(rates.loc[label, "size"]) if label in rates.index else 0,
                                "rate": round(float(rates.loc[label, "mean"]), 4) if label in rates.index else None}
                               for label, codes in defs],
                    "test": group_test(df, groups)}
    ages = pd.cut(df["Age at enrollment"], AGE_BINS, labels=AGE_LABELS).astype(str)
    rates = df.groupby(ages)["Dropout"].agg(["size", "mean"])
    out["Age at enrollment"] = {"bins": AGE_BINS,
                                "groups": [{"label": a, "n": int(rates.loc[a, "size"]),
                                            "rate": round(float(rates.loc[a, "mean"]), 4)} for a in AGE_LABELS],
                                "test": group_test(df, ages)}
    course = df.groupby("Course")["Dropout"].agg(["size", "mean"]).sort_values("mean")
    out["Course"] = {"groups": [{"label": COURSES[c], "codes": [int(c)], "n": int(r["size"]),
                                 "rate": round(float(r["mean"]), 4)} for c, r in course.iterrows()],
                     "test": group_test(df, df["Course"])}
    # Average results of students who stayed vs dropped out (for comparison charts).
    cols = [S1A, S2A, S1G, S2G, "Curricular units 1st sem (enrolled)", "Admission grade"]
    out["means_by_outcome"] = {k: {c: round(float(v), 2) for c, v in row.items()}
                               for k, row in df.groupby(df["Dropout"].map({0: "stayed", 1: "dropped"}))[cols].mean().iterrows()}

    # Figure: dropout rate by six background factors.
    show = ["Previous qualification", "Mother's qualification", "Father's occupation",
            "Marital status", "Application mode", "Daytime/evening attendance"]
    fig, axes = plt.subplots(2, 3, figsize=(12, 6.5))
    for ax, col in zip(axes.flat, show):
        g = [x for x in out[col]["groups"] if x["n"] >= 20]
        ax.barh([x["label"] for x in g], [x["rate"] for x in g], color=INK)
        ax.axvline(df["Dropout"].mean(), ls="--", color=ACC, lw=1)
        ax.set_title(col, fontsize=10)
        ax.set_xlim(0, 1)
        ax.tick_params(labelsize=7)
    fig.supxlabel("Dropout rate (dashed line = overall 32%)", fontsize=9)
    save("eda_background_rates.png")
    print("Background tests:", {k: v["test"]["p"] for k, v in out.items() if "test" in v})
    return out


def regression(df):
    """Module 4: predict semester-2 grade, linear vs polynomial (degree 2)."""
    X, y = df[[S1G, S1A]], df[S2G]
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2,
                                          random_state=RANDOM_STATE)
    out = {}
    models = {"linear": LinearRegression(),
              "poly2": make_pipeline(PolynomialFeatures(2), LinearRegression())}
    for name, model in models.items():
        pred = model.fit(Xtr, ytr).predict(Xte)
        out[name] = {"r2": round(r2_score(yte, pred), 3),
                     "rmse": round(float(np.sqrt(mean_squared_error(yte, pred))), 3)}
    plt.figure(figsize=(5, 4))
    plt.scatter(yte, pred, s=6, alpha=.4, color=INK)
    plt.plot([0, 20], [0, 20], "--", color=ACC)
    plt.xlabel("Actual semester-2 grade")
    plt.ylabel("Predicted (polynomial)")
    save("regression_actual_vs_predicted.png")
    print("Regression:", out)
    return out


def clustering(df):
    """Module 4: K-means (elbow + silhouette) and agglomerative dendrogram."""
    cols = ["Age at enrollment", "Admission grade", S1A, S1G, S2G,
            "Tuition fees up to date"]
    Xs = StandardScaler().fit_transform(df[cols])
    ks, inertia, sil = list(range(2, 9)), [], []
    for k in ks:
        km = KMeans(n_clusters=k, n_init=10, random_state=RANDOM_STATE).fit(Xs)
        inertia.append(km.inertia_)
        sil.append(silhouette_score(Xs, km.labels_))
    fig, ax = plt.subplots(1, 2, figsize=(9, 3.5))
    ax[0].plot(ks, inertia, "o-", color=INK)
    ax[0].set(title="Elbow method", xlabel="k", ylabel="Inertia")
    ax[1].plot(ks, sil, "o-", color=ACC)
    ax[1].set(title="Silhouette score", xlabel="k", ylabel="Score")
    save("cluster_elbow_silhouette.png")

    best_k = ks[int(np.argmax(sil))]
    labels = KMeans(n_clusters=best_k, n_init=10,
                    random_state=RANDOM_STATE).fit_predict(Xs)
    prof = df[cols + ["Dropout"]].groupby(labels).mean()
    prof["size"] = pd.Series(labels).value_counts().sort_index()
    prof.columns = ["age", "admission", "approved1", "grade1", "grade2",
                    "fees", "dropout", "size"]
    print(f"k={best_k}\n", prof.round(2))

    sample = Xs[np.random.RandomState(RANDOM_STATE).choice(len(Xs), 200, False)]
    plt.figure(figsize=(9, 4))
    dendrogram(linkage(sample, method="ward"), no_labels=True)
    plt.title("Agglomerative clustering (Ward), 200-student sample")
    save("cluster_dendrogram.png")
    return {"k": best_k, "silhouette": [round(s, 3) for s in sil],
            "profile": prof.round(2).sort_values("dropout").to_dict("records")}


def main():
    FIG.mkdir(parents=True, exist_ok=True)
    df = load_data()
    save_results("data", {"explore": explore(df), "inference": inference(df),
                          "background": background(df),
                          "regression": regression(df),
                          "clusters": clustering(df)})
    print("Saved figures and reports/results.json")


if __name__ == "__main__":
    main()
