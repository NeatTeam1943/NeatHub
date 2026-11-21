# NEATHUB

האב הקישורים של FRC Team 1943: כל האב הוא ארגז כלים (kit tote), כל קישור בו הוא חלק משחק מהעונה של הארגז, והאבים הפנימיים הם ארגזים קטנים יותר.

**זה טאב בתוך [NeatSystem](https://github.com/NeatTeam1943/NeatSystem)**: הריפו הזה הוא ה-submodule `systems/neathub` שם. אין לו אתר, התחברות או טבלת משתמשים משלו.

## מה יש כאן

| מה | איפה |
|---|---|
| הייצוא של הטאב (חוזה 1) | `neatsystem/tab.jsx` |
| האפליקציה: במה, ארגזים, חלקים, מגירת עריכה, חיפוש, "מי עורך מה" | `src/` |
| גישה לנתונים: Supabase / זיכרון (מצב mock של NeatSystem) | `src/lib/store.js` |
| הטבלאות והפונקציות (אותם כללים כמו `firestore.rules` הישן) | `supabase/migrations/0001_neathub.sql` |
| בדיקות SQL (רצות ב-CI של NeatSystem) | `supabase/tests/` |
| בדיקות המודל | `tests/` (`npm test`) |

## איך זה מתחבר ל-NeatSystem

- **התחברות ותפקידים**: של NeatSystem.
  - מנטור כאן = מי שיש לו `neathub.manage` (ברירת מחדל: מנטורים ואדמינים).
  - ראש צוות = `neathub.lead` (ברירת מחדל: רש"צים וקפטנים).
  - כל חבר פעיל = חבר.
  - מנטור מחלק לראשי צוות ארגזים לעריכה בעמוד "מי עורך מה" (`#/neathub/admin`).
- **נתונים**: בפרויקט ה-Supabase של NeatSystem.
  - `neathub` — הטבלאות, סגורות.
  - `neathub_api` — הפונקציות.
  - הכתובת של קישור נשמרת בנפרד, וחוזרת רק למי שמותר לו לפתוח אותו.
- **קישורים לשיתוף**: `…/NeatSystem/#/neathub/software/vision`.
- **עיצוב**: הטוקנים והכפתורים של NeatSystem. הארגזים והחלקים שומרים על המראה שלהם (`src/styles/tote.css`).

## עבודה על הטאב

מפתחים מתוך NeatSystem:

```bash
git clone --recurse-submodules https://github.com/NeatTeam1943/NeatSystem.git
cd NeatSystem && npm install && npm run dev:mock
cd systems/neathub        # כאן עורכים, עושים commit ו-push לריפו הזה
```

## הקמה (פעם אחת)

1. ב-Supabase של NeatSystem, אחרי המיגרציות של NeatSystem: להריץ את `supabase/migrations/0001_neathub.sql`.
2. Settings → API → Exposed schemas: להוסיף `neathub_api`.
3. העברת הקישורים מ-Firestore: ב-NeatSystem מריצים `node scripts/import-firebase.mjs`. הוא מעביר:
   - את כל הארגזים, הקישורים והתמונות.
   - את "מי עורך מה", לפי אותו מייל של Google.
   - את הקישורים הנעולים, רק אם מדביקים את ה-token שהסקריפט מבקש.

## הוספת עונה

מוסיפים את החלקים ל-`PIECES` ואת העונה ל-`SEASONS` ב-`src/lib/seasons.js`.
