// "About" dialog: what NEATHUB is and how to use it.
export default function About({ onClose }) {
  const base = `${location.origin}${location.pathname}`
  return (
    <div className="scrim center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal about" role="dialog" aria-modal="true" aria-labelledby="about-title">
        <button type="button" className="icon-btn about-x" onClick={onClose} aria-label="סגירה"><i className="ti ti-x" /></button>
        <h2 id="about-title">מה זה NEATHUB?</h2>
        <p>
          NEATHUB הוא מפה לקישורים השימושיים ביותר של כל צוות וקבוצה ב-<bdi className="nowrap">Neat Team 1943</bdi>, כדי
          שכל אחד ימצא מהר את מה שהוא צריך.
        </p>
        <p className="about-note">
          <b>חשוב:</b> NEATHUB לא מחליף את ה-Drive. אין כאן אחסון קבצים. הקבצים נשארים במקום שלהם, וכאן רק מקשרים אל
          תיקיות חשובות או קבצים ספציפיים.
        </p>

        <h3>איך זה בנוי?</h3>
        <ul>
          <li><b>ארגז</b> הוא האב: אוסף של קישורים בנושא אחד. ארגז יכול להכיל גם ארגזים קטנים יותר.</li>
          <li><b>קובייה או חלק משחק</b> הוא קישור: לאתר, לתיקייה ב-Drive, למצגת, ל-Canva וכו'.</li>
        </ul>

        <p>
          <b>כלל אצבע:</b> ארגז עם יותר מ-6 פריטים הוא מלא מדי. אולי כדאי להפוך אותו לתיקיית Drive ולקשר אליה.
        </p>

        <h3>שיתוף ארגז</h3>
        <p>
          לכל ארגז יש קישור משלו, ואפשר לשלוח אותו ישירות. אם הוגדר לארגז שם קישור, הכתובת תהיה קריאה, למשל:
        </p>
        <code className="about-url" dir="ltr">{base}#/teams/software</code>
        <p>
          אם לא הוגדר, הכתובת תהיה רצף אותיות אקראי. לכן כדאי להגדיר שם קישור לכל ארגז שמתכננים לשתף.
        </p>

        <button type="button" className="btn primary" onClick={onClose}>הבנתי</button>
      </div>
    </div>
  )
}
