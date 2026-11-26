"""TF-IDF transaction auto-categorisation service with keyword fallback."""
import uuid

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Category, Transaction

KEYWORD_HINTS: dict[str, tuple[str, ...]] = {
    "Salary": ("salary", "payroll", "paycheck", "wages"),
    "Freelance": ("freelance", "retainer", "consulting", "client", "invoice"),
    "Investment": ("dividend", "interest", "brokerage", "etf", "stock"),
    "Rent": ("rent", "lease", "landlord", "mortgage", "apartment"),
    "Groceries": ("grocer", "supermarket", "freshmart", "market", "whole foods", "aldi", "lidl", "biedronka"),
    "Dining": ("lunch", "dinner", "cafe", "café", "coffee", "restaurant", "sushi", "brunch", "pizza"),
    "Transport": ("transit", "uber", "lyft", "ride", "train", "metro", "fuel", "gas", "parking"),
    "Utilities": ("electric", "internet", "water", "gridpower", "fiber", "phone", "utility"),
    "Shopping": ("shoes", "amazon", "store", "clothes", "supplies", "mall"),
    "Entertainment": ("concert", "netflix", "spotify", "streaming", "cinema", "movie", "ticket"),
    "Healthcare": ("pharmacy", "doctor", "dental", "clinic", "hospital", "medical"),
    "Transfer": ("transfer", "savings transfer", "internal"),
}


async def suggest_category_for_text(
    db: AsyncSession,
    user_id: uuid.UUID,
    description: str,
    tx_type: str = "debit",
) -> tuple[uuid.UUID | None, str | None, float]:
    expected_cat_type = (
        "income" if tx_type == "credit" else "transfer" if tx_type == "transfer" else "expense"
    )
    categories = list(
        await db.scalars(
            select(Category).where(
                Category.user_id == user_id,
                Category.type == expected_cat_type,
            )
        )
    )
    if not categories:
        categories = list(await db.scalars(select(Category).where(Category.user_id == user_id)))
    if not categories:
        return None, None, 0.0

    cat_by_id = {c.id: c for c in categories}
    cat_by_name_lower = {c.name.lower(): c for c in categories}

    # 1. Try supervised TF-IDF + MultinomialNB on user's historical labelled transactions
    txns = list(
        await db.scalars(
            select(Transaction).where(
                Transaction.user_id == user_id,
                Transaction.description.is_not(None),
            )
        )
    )
    valid_samples = [
        (t.description or "", str(t.category_id))
        for t in txns
        if t.category_id in cat_by_id and (t.description or "").strip()
    ]
    distinct_labels = {lbl for _, lbl in valid_samples}
    if len(valid_samples) >= 6 and len(distinct_labels) >= 2:
        corpus = [text for text, _ in valid_samples]
        labels = [lbl for _, lbl in valid_samples]
        vec = TfidfVectorizer(ngram_range=(1, 2), lowercase=True)
        X = vec.fit_transform(corpus)
        clf = MultinomialNB(alpha=0.3)
        clf.fit(X, labels)
        q_vec = vec.transform([description])
        if q_vec.nnz > 0:
            probs = clf.predict_proba(q_vec)[0]
            best_idx = int(probs.argmax())
            best_prob = float(probs[best_idx])
            pred_id = uuid.UUID(clf.classes_[best_idx])
            if best_prob >= 0.25 and pred_id in cat_by_id:
                chosen = cat_by_id[pred_id]
                return chosen.id, chosen.name, round(best_prob, 2)

    # 2. Deterministic keyword fallback
    desc_lower = description.lower()
    for canonical_name, keywords in KEYWORD_HINTS.items():
        if any(kw in desc_lower for kw in keywords):
            matched = cat_by_name_lower.get(canonical_name.lower())
            if matched:
                return matched.id, matched.name, 0.8

    fallback = categories[0]
    return fallback.id, fallback.name, 0.2
