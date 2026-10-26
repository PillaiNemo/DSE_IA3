"""Package real results and model parameters for the website.

Run after train.py and both analysis scripts:  python src/export_web.py
Writes web/data.js, which the website reads. No numbers are typed by hand.
"""
import json
import sys
from pathlib import Path

import joblib
import pandas as pd

sys.path.append(str(Path(__file__).resolve().parent))
from data_utils import (MODEL_DIR, REPORT_DIR, ROOT, get_split, load_data,  # noqa
                        split_features_target)


def risk_tier(p):
    """Red / Yellow / Green tiers, as asked in the problem statement."""
    if p > 0.66:
        return "Red"
    if p >= 0.33:
        return "Yellow"
    return "Green"


def dashboard_students(model, X_test, y_test):
    """Test-set students (never seen in training), scored by the best model."""
    probs = model.predict_proba(X_test)[:, 1]
    rows = []
    for i in range(len(X_test)):
        rows.append({"id": f"S{i + 1:03d}", "risk": round(float(probs[i]), 4),
                     "tier": risk_tier(probs[i]), "actual": int(y_test.iloc[i]),
                     "x": X_test.iloc[i].round(2).tolist()})
    return rows


def main():
    X, y = split_features_target(load_data())
    X_train, X_test, y_train, y_test = get_split(X, y)
    bundle = joblib.load(MODEL_DIR / "model_bundle.joblib")
    lr = bundle["models"]["Logistic Regression"]
    scaler, clf = lr.named_steps["scaler"], lr.named_steps["clf"]
    out = {
        "best": bundle["best_name"],
        "features": bundle["features"],
        "defaults": {k: round(float(v), 2) for k, v in bundle["defaults"].items()},
        "lr": {"mean": scaler.mean_.round(5).tolist(),
               "scale": scaler.scale_.round(5).tolist(),
               "coef": clf.coef_[0].round(5).tolist(),
               "intercept": round(float(clf.intercept_[0]), 5)},
        # Training students, for the in-browser similarity recommender.
        "train_X": X_train.round(2).values.tolist(), "train_y": y_train.tolist(),
        "students": dashboard_students(bundle["models"][bundle["best_name"]],
                                       X_test, y_test),
        "results": pd.read_csv(MODEL_DIR / "results.csv").to_dict("records"),
        "analysis": json.loads((REPORT_DIR / "results.json").read_text()),
    }
    web = ROOT / "web"
    web.mkdir(exist_ok=True)
    text = "window.EDU = " + json.dumps(out, separators=(",", ":")) + ";\n"
    (web / "data.js").write_text(text, encoding="utf-8")
    print(f"Saved web/data.js ({len(text) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
