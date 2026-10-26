"""Loading and preparing the UCI student dropout dataset.

Dataset: "Predict Students' Dropout and Academic Success" (Realinho et al., 2021),
4,424 students, 36 features, no missing values. File separator is ';'.
"""
import json
from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "data.csv"
MODEL_DIR = ROOT / "models"
REPORT_DIR = ROOT / "reports"
RANDOM_STATE = 42


def load_data(path=DATA_PATH):
    """Read the CSV and add the binary target column."""
    df = pd.read_csv(path, sep=";")
    # One header in the raw file contains a stray tab character, so strip names.
    df.columns = [col.strip() for col in df.columns]
    # Binary target: 1 = dropped out, 0 = enrolled or graduated.
    df["Dropout"] = (df["Target"] == "Dropout").astype(int)
    return df


def split_features_target(df):
    """Return the feature table X and the target vector y."""
    return df.drop(columns=["Target", "Dropout"]), df["Dropout"]


def get_split(X, y):
    """Stratified 80/20 split so both parts keep the same dropout rate."""
    return train_test_split(X, y, test_size=0.2, stratify=y,
                            random_state=RANDOM_STATE)


def save_results(section, values):
    """Store numbers in reports/results.json under one section name."""
    REPORT_DIR.mkdir(exist_ok=True)
    path = REPORT_DIR / "results.json"
    data = json.loads(path.read_text()) if path.exists() else {}
    data[section] = values
    path.write_text(json.dumps(data, indent=1, default=float))
