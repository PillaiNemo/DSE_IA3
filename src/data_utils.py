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


# Family and background columns are stored as category codes (e.g. mother's
# occupation 9 = unskilled worker). The codes are labels, not amounts, so we
# group them into a few readable categories for statistics and the website.
# Code meanings come from the UCI dataset description.
PARENT_EDU = [("Degree or higher", [2, 3, 4, 5, 6, 40, 41, 43, 44]),
              ("Finished 12th or technical course", [1, 13, 18, 20, 22, 31, 33, 39, 42]),
              ("Did not finish 12th", [9, 10, 11, 12, 14, 19, 25, 26, 27, 29, 30, 35, 36, 37, 38]),
              ("Not known", [34])]
PARENT_JOB = [("Manager or professional", [1, 2, 3]),
              ("Office, sales or services", [4, 5]),
              ("Farming, trade or machines", [6, 7, 8]),
              ("Unskilled work", [9]),
              ("Armed forces", [10]),
              ("Student", [0]),
              ("Other or not known", [90, 99])]
BACKGROUND = {
    "Previous qualification": [
        ("Finished 12th", [1]),
        ("Did not finish 12th", [9, 10, 12, 14, 15, 19, 38]),
        ("Technical course", [39, 42]),
        ("Already studied at university", [2, 3, 4, 5, 6, 40, 43])],
    "Mother's qualification": PARENT_EDU,
    "Father's qualification": PARENT_EDU,
    "Mother's occupation": PARENT_JOB,
    "Father's occupation": PARENT_JOB,
    "Marital status": [("Single", [1]), ("Married or partner", [2, 5]),
                       ("Divorced, separated or widowed", [3, 4, 6])],
    "Nacionality": [("Local", [1]),
                    ("International", [2, 6, 11, 13, 14, 17, 21, 22, 24, 25, 26, 32,
                                       41, 62, 100, 101, 103, 105, 108, 109])],
    "Application mode": [
        ("First admission round", [1, 5, 16]),
        ("Later admission round", [17, 18]),
        ("Mature entry (over 23)", [39]),
        ("Transfer or change of course", [42, 43, 51, 57]),
        ("Already holds a diploma", [7, 44, 53]),
        ("Other special route", [2, 10, 15, 26, 27])],
    "Daytime/evening attendance": [("Daytime", [1]), ("Evening", [0])],
    "Displaced": [("Lives at home", [0]), ("Lives away from home", [1])],
    "Educational special needs": [("No", [0]), ("Yes", [1])],
}
COURSES = {33: "Biofuel Production Technologies", 171: "Animation and Multimedia Design",
           8014: "Social Service (evening)", 9003: "Agronomy", 9070: "Communication Design",
           9085: "Veterinary Nursing", 9119: "Informatics Engineering", 9130: "Equinculture",
           9147: "Management", 9238: "Social Service", 9254: "Tourism", 9500: "Nursing",
           9556: "Oral Hygiene", 9670: "Advertising and Marketing", 9773: "Journalism and Communication",
           9853: "Basic Education", 9991: "Management (evening)"}


def background_group(column, code):
    """Readable category for one coded background value."""
    code = int(code)
    if column in ("Mother's occupation", "Father's occupation") and code >= 100:
        code = (code - 100) // 10 or 10      # 3-digit sub-codes: 122 -> 2, 101 -> armed forces
    for label, codes in BACKGROUND[column]:
        if code in codes:
            return label
    raise ValueError(f"{column}: code {code} has no group")


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
