# EduGuard: AI-based Drop-out Prediction and Counselling System

Course project for **Data Science Ecosystem (23CS2024)**, based on SIH 2025 problem
statement **SIH25102**, *AI-based drop-out prediction and counseling system*.

EduGuard predicts which students are at risk of dropping out, classifies them as
**Red / Yellow / Green**, explains the reasons, and suggests counselling support.
A counsellor dashboard lists students with an alert draft. It supports counsellors;
it never decides on its own.

## Dataset
UCI *Predict Students' Dropout and Academic Success* (Realinho et al., 2021):
4,424 students from a university in Portugal, 36 features, no missing values
(`data/data.csv`, separator `;`). Target: `Dropout = 1` if `Target == "Dropout"`, else 0
(32.1% dropouts).

## Project structure
**1. DSE logic - explain this**
```
src/data_utils.py       load data, binary target, 80/20 stratified split, family/background code groups
src/train.py            Logistic Regression, KNN, Decision Tree: tuned with 5-fold CV, compared, best saved
src/recommender.py      cosine-similarity neighbours + support rules, incl. background rules (Module 5)
src/analysis_data.py    EDA, descriptive stats, CI, t-test, chi-square, family/background factors
                        (group dropout rates + chi-square + Cramer's V), regression, K-means, dendrogram
src/analysis_model.py   confusion matrix, ROC, comparison, overfitting check, fairness, model weights
src/export_web.py       packages real results + model weights into web/data.js
web/model.js            the website's calculations: scaling, logistic regression, risk tier,
                        cosine similarity, support rules (same as the Python code),
                        background groups, what-if scenarios
```
**Generated outputs (do not edit by hand)**
```
models/                 saved models + results.csv          (train.py)
reports/figures/        all report figures (PNG)            (analysis scripts)
reports/results.json    every statistic in one file         (analysis scripts)
web/data.js             numbers + weights for the website   (export_web.py)
```
**2. Design / interface - no DSE logic**
```
index.html              Overview          analysis.html   Data analysis
dashboard.html          Counsellor dashboard   models.html     Models
checker.html            Check a student   ethics.html     Ethics & fairness
report.html             printable counsellor reports (summary or one student) -> Save as PDF
ui/base.css, ui/common.js   shared layout (top menu, footer, scroll animations), colours, helpers
ui/*.css, ui/*.js           one design file pair per page
```

## Syllabus coverage
| Module | Technique | Where |
|---|---|---|
| 1 Basics | dataset from a repository | UCI dataset |
| 2 Understanding data | import, filter, group, missing values, plots | `analysis_data.py`, Data analysis page |
| 3 Statistical inference | mean/median/var/std, correlation, CI, t-test, chi-square | `analysis_data.py` |
| 4 Machine learning | multiple + polynomial regression, logistic regression, KNN, decision tree, K-means, agglomerative, evaluation | `train.py`, both analysis scripts |
| 5 Recommender | similarity-based (cosine) recommender + rules | `recommender.py`, `web/model.js` |
| 6 Ethics | fairness by gender/scholarship, explainability, safeguards | `analysis_model.py`, Ethics page |

## Run locally
Windows (cmd), from this folder:
```
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python src\train.py
python src\analysis_data.py
python src\analysis_model.py
python src\export_web.py
python -m http.server 8000
```
Open http://localhost:8000. (Mac/Linux: `python3`, `source .venv/bin/activate`, `/`.)
The results are already included, so only the last command is needed just to view the site.

## Deploy (GitHub Pages)
Upload all files to a public GitHub repository, then **Settings → Pages → Deploy from a
branch → main / (root) → Save**. The site appears at `https://<username>.github.io/<repo>/`.

## Limitations
- Data from one university in Portugal; results may not transfer elsewhere.
- Semester-2 grades are used, so this is a mid-course warning, not an admission-time one.
- Support rules are written assumptions; alerts are drafts and are never sent automatically.
- Family/background columns (parents' education and jobs, course, nationality, ...) are category
  codes. The trained model reads them as plain numbers, so the website does not let these answers
  change the score; it shows the dropout rate of past students in the same group instead.
  One-hot encoding these columns and retraining would be the proper fix (future work).
