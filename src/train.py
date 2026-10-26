"""Train Logistic Regression, KNN and Decision Tree; compare them; save the best.

Run from the project folder:  python src/train.py
"""
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, f1_score, precision_score,
                             recall_score, roc_auc_score)
from sklearn.model_selection import GridSearchCV, StratifiedKFold, cross_validate
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier

sys.path.append(str(Path(__file__).resolve().parent))
from data_utils import (MODEL_DIR, RANDOM_STATE, get_split, load_data,  # noqa: E402
                        split_features_target)

CV = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)


def build_models():
    """Three pipelines plus a small grid of settings for each.

    Scaling sits inside the pipeline, so it is learned only on training folds.
    class_weight='balanced' handles the 32% / 68% class imbalance.
    """
    log_reg = Pipeline([("scaler", StandardScaler()),
                        ("clf", LogisticRegression(max_iter=2000,
                                                   class_weight="balanced"))])
    knn = Pipeline([("scaler", StandardScaler()),
                    ("clf", KNeighborsClassifier())])
    tree = Pipeline([("clf", DecisionTreeClassifier(
        class_weight="balanced", random_state=RANDOM_STATE))])
    return {
        "Logistic Regression": (log_reg, {"clf__C": [0.1, 1, 10]}),
        "KNN": (knn, {"clf__n_neighbors": [5, 11, 21, 31]}),
        "Decision Tree": (tree, {"clf__max_depth": [3, 5, 7, 10]}),
    }


def evaluate(model, X_test, y_test):
    """Test-set metrics for the dropout class (class 1)."""
    pred = model.predict(X_test)
    prob = model.predict_proba(X_test)[:, 1]
    return {"Accuracy": accuracy_score(y_test, pred),
            "Precision": precision_score(y_test, pred),
            "Recall": recall_score(y_test, pred),
            "F1": f1_score(y_test, pred),
            "ROC-AUC": roc_auc_score(y_test, prob)}


def train_models(X_train, y_train, X_test, y_test):
    """Tune each model with 5-fold CV, then score it once on the test set."""
    fitted, rows = {}, []
    for name, (pipe, grid) in build_models().items():
        search = GridSearchCV(pipe, grid, scoring="f1", cv=CV).fit(X_train, y_train)
        best = search.best_estimator_
        cv = cross_validate(best, X_train, y_train, cv=CV,
                            scoring=["f1", "recall"])
        row = {"Model": name, "Best params": str(search.best_params_)}
        row.update(evaluate(best, X_test, y_test))
        row["CV F1"] = cv["test_f1"].mean()
        row["CV F1 std"] = cv["test_f1"].std()
        row["CV Recall"] = cv["test_recall"].mean()
        rows.append(row)
        fitted[name] = best
    return fitted, pd.DataFrame(rows)


def main():
    X, y = split_features_target(load_data())
    X_train, X_test, y_train, y_test = get_split(X, y)
    fitted, results = train_models(X_train, y_train, X_test, y_test)

    # Best model by cross-validated RECALL: in an early-warning system, missing
    # a student who will drop out is worse than a false alarm a counsellor clears.
    best_name = results.sort_values("CV Recall", ascending=False).iloc[0]["Model"]

    MODEL_DIR.mkdir(exist_ok=True)
    results.round(4).to_csv(MODEL_DIR / "results.csv", index=False)
    joblib.dump({"best_name": best_name, "models": fitted,
                 "features": list(X.columns),
                 "defaults": X_train.median().to_dict()},
                MODEL_DIR / "model_bundle.joblib")

    pd.set_option("display.width", 160)
    print(results.drop(columns="Best params").round(3).to_string(index=False))
    print("\nBest params:", dict(zip(results["Model"], results["Best params"])))
    print(f"Best model by CV recall: {best_name} -> saved to models/")


if __name__ == "__main__":
    main()
