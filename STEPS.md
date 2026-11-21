# שלב 2 מתוך 3 — NeatHub

1. מחלצים את ה-zip הזה. ב-Terminal עוברים לתיקייה של הריפו NeatHub.
2. מריצים (במקום `PATH` שמים את התיקייה שחילצת):
```bash
git checkout main && git pull
git checkout -b neatsystem-tab
git apply --binary PATH/3-NeatHub.patch
git add -A
git commit -m "NEATHUB as a NeatSystem tab"
git push -u origin neatsystem-tab
```
3. ב-GitHub: פותחים Pull Request מ-`neatsystem-tab` ועושים Merge ל-`main`.

כרגע לא עושים כלום עם `0001_neathub.sql`, הוא נכנס לשימוש בשלב 3.

זהו. עוברים לשלב 3 (NeatSystem).
