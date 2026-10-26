"""Similarity-based support recommender (syllabus Module 5).

Idea (like user-user collaborative filtering): find the past students most
similar to this student (cosine similarity on scaled features), see how many
of them dropped out, and combine that with simple, transparent support rules.

NOTE: the rules below are our own assumptions written for counsellors.
They are NOT learned from data (the dataset has no "intervention" column).
"""
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler


def fit_recommender(X_train, y_train):
    """Store a scaler and the scaled training students for later lookups."""
    scaler = StandardScaler().fit(X_train)
    return {"scaler": scaler, "X_scaled": scaler.transform(X_train),
            "y": np.asarray(y_train)}


def similar_students(rec, student_row, k=5):
    """Indices, similarities and outcomes of the k most similar past students."""
    vec = rec["scaler"].transform(student_row)
    sims = cosine_similarity(vec, rec["X_scaled"])[0]
    top = np.argsort(sims)[::-1][:k]
    return top, sims[top], rec["y"][top]


def rule_suggestions(s):
    """Plain-English support actions. s is a dict of one student's values."""
    tips = []
    if s["Tuition fees up to date"] == 0:
        tips.append("Fees are not up to date: refer to the financial-aid office.")
    if s["Debtor"] == 1:
        tips.append("Student owes money: book a counselling meeting about finances.")
    enrolled = max(s["Curricular units 1st sem (enrolled)"], 1)
    if s["Curricular units 1st sem (approved)"] / enrolled < 0.5:
        tips.append("Passed under half of semester-1 subjects: arrange peer tutoring.")
    if s["Curricular units 2nd sem (grade)"] < 10:
        tips.append("Semester-2 average below 10/20: assign an academic mentor.")
    if s["Scholarship holder"] == 0 and s["Debtor"] == 1:
        tips.append("No scholarship and in debt: check scholarship eligibility.")
    return tips


def get_recommendation(rec, student_row, k=5):
    """Neighbour summary plus up to 3 suggestions for one student (1-row df)."""
    _, sims, outcomes = similar_students(rec, student_row, k)
    tips = rule_suggestions(student_row.iloc[0].to_dict())
    if outcomes.mean() >= 0.6:
        tips.insert(0, f"{int(outcomes.sum())} of {k} similar past students "
                       "dropped out: schedule a check-in this week.")
    if not tips:
        tips.append("No warning signs: continue regular mentor check-ins.")
    return {"neighbour_dropout_rate": outcomes.mean(),
            "mean_similarity": sims.mean(), "suggestions": tips[:3]}
