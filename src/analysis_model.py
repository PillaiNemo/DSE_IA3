"""Evaluating the trained models: Module 4 (evaluation) and Module 6 (ethics).

Confusion matrix, ROC curves, model comparison, overfitting check (tree depth),
fairness by gender and scholarship, logistic regression weights, and an
evaluation of the similarity-based recommender (Module 5).
Run after train.py:  python src/analysis_model.py
"""
import sys
from pathlib import Path

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from sklearn.metrics import ConfusionMatrixDisplay, confusion_matrix, roc_curve  # noqa
from sklearn.metrics import accuracy_score, precision_score, recall_score  # noqa: E402
from sklearn.metrics.pairwise import cosine_similarity  # noqa: E402
from sklearn.tree import DecisionTreeClassifier  # noqa: E402

sys.path.append(str(Path(__file__).resolve().parent))
from data_utils import (MODEL_DIR, RANDOM_STATE, REPORT_DIR, get_split,  # noqa
                        load_data, save_results, split_features_target)
from recommender import fit_recommender  # noqa: E402

FIG = REPORT_DIR / "figures"
INK, ACC, GREY = "#1c1b19", "#e4572e", "#b9b5ab"


def save(name):
    plt.tight_layout()
    plt.savefig(FIG / name, dpi=150)
    plt.close()


def evaluation(bundle, X_test, y_test):
    """Confusion matrix of the best model, ROC curves and comparison chart."""
    best = bundle["models"][bundle["best_name"]]
    cm = confusion_matrix(y_test, best.predict(X_test))
    ConfusionMatrixDisplay(cm, display_labels=["Not dropout", "Dropout"]).plot(
        cmap="Greys", colorbar=False)
    plt.title(f"{bundle['best_name']} (test set)")
    save("model_confusion_matrix.png")

    roc = {}
    plt.figure(figsize=(5.5, 4.5))
    for (name, model), color in zip(bundle["models"].items(), [ACC, GREY, INK]):
        fpr, tpr, _ = roc_curve(y_test, model.predict_proba(X_test)[:, 1])
        idx = np.unique(np.linspace(0, len(fpr) - 1, 60).astype(int))
        roc[name] = [[round(fpr[i], 3), round(tpr[i], 3)] for i in idx]
        plt.plot(fpr, tpr, color=color, label=name)
    plt.plot([0, 1], [0, 1], "k--", lw=1)
    plt.xlabel("False positive rate")
    plt.ylabel("True positive rate (recall)")
    plt.legend()
    save("model_roc_curves.png")

    res = pd.read_csv(MODEL_DIR / "results.csv").set_index("Model")
    res[["Accuracy", "Precision", "Recall", "F1", "ROC-AUC"]].T.plot(
        kind="bar", figsize=(8, 4), color=[ACC, GREY, INK])
    plt.ylim(0, 1)
    plt.ylabel("Test-set score")
    plt.xticks(rotation=0)
    save("model_comparison.png")
    return {"confusion": cm.tolist(), "roc": roc}


def overfitting(X_train, y_train, X_test, y_test):
    """Tree depth vs train and test accuracy: deep trees memorise the data."""
    depths, train_acc, test_acc = list(range(1, 16)), [], []
    for d in depths:
        tree = DecisionTreeClassifier(max_depth=d, random_state=RANDOM_STATE)
        tree.fit(X_train, y_train)
        train_acc.append(round(tree.score(X_train, y_train), 3))
        test_acc.append(round(tree.score(X_test, y_test), 3))
    plt.figure(figsize=(6, 3.8))
    plt.plot(depths, train_acc, "o-", color=INK, label="Training accuracy")
    plt.plot(depths, test_acc, "o-", color=ACC, label="Test accuracy")
    plt.xlabel("Tree depth")
    plt.ylabel("Accuracy")
    plt.legend()
    save("model_overfitting_tree_depth.png")
    print("Depth  train  test:", list(zip(depths, train_acc, test_acc)))
    return {"depths": depths, "train": train_acc, "test": test_acc}


def ethics(bundle, X_test, y_test):
    """Fairness by gender and scholarship; top logistic regression weights."""
    pred = bundle["models"][bundle["best_name"]].predict(X_test)
    test = X_test.assign(y=y_test.values, pred=pred)
    fair = []
    for col, names in [("Gender", ["Female", "Male"]),
                       ("Scholarship holder", ["No scholarship", "Scholarship"])]:
        for val, g in test.groupby(col):
            fair.append({"group": names[val], "n": len(g),
                         "actual": round(g["y"].mean(), 3),
                         "predicted": round(g["pred"].mean(), 3),
                         "recall": round((g["pred"][g["y"] == 1] == 1).mean(), 3)})
    print(pd.DataFrame(fair).to_string(index=False))

    clf = bundle["models"]["Logistic Regression"].named_steps["clf"]
    w = pd.Series(clf.coef_[0], bundle["features"])
    top = w.reindex(w.abs().sort_values(ascending=False).index)[:10][::-1]
    plt.figure(figsize=(7, 4.5))
    plt.barh([n.replace("Curricular units ", "") for n in top.index], top.values,
             color=[ACC if v > 0 else "#2f6f4f" for v in top])
    plt.xlabel("Weight (on scaled inputs): + raises risk, - lowers it")
    save("model_lr_weights.png")
    return {"fairness": fair, "weights": top[::-1].round(3).to_dict()}


def recommender_eval(X_train, y_train, X_test, y_test, k=5):
    """Module 5: evaluate the neighbour signal used by the recommender.

    For each test student, find the k most similar training students (cosine
    similarity). The recommender raises a "check-in" suggestion when at least
    3 of the 5 neighbours dropped out; here we check how often that is right.
    """
    rec = fit_recommender(X_train, y_train)
    sims = cosine_similarity(rec["scaler"].transform(X_test), rec["X_scaled"])
    top = np.argsort(-sims, axis=1)[:, :k]
    share = rec["y"][top].mean(axis=1)            # share of neighbours who dropped out
    flag = (share >= 0.6).astype(int)               # 3 or more of 5
    out = {"k": k, "flagged": int(flag.sum()),
           "accuracy": round(accuracy_score(y_test, flag), 3),
           "precision": round(precision_score(y_test, flag), 3),
           "recall": round(recall_score(y_test, flag), 3)}
    print("Recommender neighbour signal:", out)
    return out


def main():
    FIG.mkdir(parents=True, exist_ok=True)
    X, y = split_features_target(load_data())
    X_train, X_test, y_train, y_test = get_split(X, y)
    bundle = joblib.load(MODEL_DIR / "model_bundle.joblib")
    save_results("model", {"evaluation": evaluation(bundle, X_test, y_test),
                           "overfitting": overfitting(X_train, y_train,
                                                      X_test, y_test),
                           "ethics": ethics(bundle, X_test, y_test),
                           "recommender": recommender_eval(X_train, y_train,
                                                           X_test, y_test),
                           "train_size": len(X_train), "test_size": len(X_test)})
    print("Saved figures and reports/results.json")


if __name__ == "__main__":
    main()
