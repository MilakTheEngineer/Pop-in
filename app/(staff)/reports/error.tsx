'use client';
import './daily-report.css';

export default function DailyReportError({retry}:{retry:()=>void}){
 return <main className="daily-page"><div className="eyebrow">YOUR SHOP / REPORTS</div><h1>Daily close</h1><section className="daily-card daily-failure" role="alert"><h2>The report couldn’t be loaded</h2><p>Check your connection and try again. No changes were made.</p><button className="primary" type="button" onClick={retry}>Try again</button></section></main>;
}
