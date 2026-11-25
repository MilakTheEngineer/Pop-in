import type {Metadata} from 'next';
import Link from 'next/link';
import {ReportTrigger} from '@/app/report-issue';

export const metadata:Metadata={title:'Privacy | Varello',description:'How Varello uses account, booking and support information, and how to ask for help.'};

export default function Privacy(){return <main className="landing"><article className="plan-detail">
 <Link href="/">← Varello</Link>
 <div className="eyebrow">YOUR INFORMATION</div>
 <h1>Privacy</h1>
 <p>Varello helps shops manage bookings and their day-to-day work. The shop you book with manages your appointment and customer record. Varello provides the software and handles account and service support.</p>
 <h2>What we collect and why</h2>
 <p>Booking forms collect the details shown on the form, such as your name, contact details, service, barber and appointment time. Shops use these details to arrange your visit, manage changes and keep booking records. Required fields are marked or checked before submission; without them, the online booking or queue entry cannot be completed. Optional fields and reminder choices are labelled.</p>
 <p>Shop accounts include sign-in details, shop information and team membership. Staff workspaces can also hold shifts, client notes, time-off requests and recorded payments. Access follows the account’s role and assigned shops. Private time-off reasons are visible to the employee and owner, not customers.</p>
 <h2>Email, texts and connected services</h2>
 <p>When a shop’s email connection is enabled, booking confirmations, changes and cancellations can be sent by email. Appointment reminders use the contact details and reminder choices saved with the booking. SMS reminders also depend on the shop’s settings and available text credits.</p>
 <p>Test and preview screens identify when messages are simulated or not sent. A saved booking or a queued message does not by itself mean an email or text has been delivered.</p>
 <p>Varello uses hosting and database services to run the app. Where enabled, Resend handles email, WebSMS handles texts, Stripe handles payment checkout, and Google Calendar handles connected calendar sync. The relevant provider receives the information needed for that function. Their processing locations depend on the service and its configuration.</p>
 <h2>Private links and browser storage</h2>
 <p>Keep your private booking, visit and queue links safe: someone with the full link may be able to view or change that booking. Varello uses cookies for signed-in sessions, shop selection and report rate limits, and browser storage for parts of the booking flow. Do not share a device’s signed-in session with someone who should not have access.</p>
 <h2>Support and feedback</h2>
 <p>Issue reports contain your description, a general screen name and an optional reply email. They go to Varello’s private operator queue. The form does not attach your full page URL or customer record. Recognised links, email addresses and phone numbers are removed from the description, but please leave customer details out. Founder feedback is linked to the relevant shop.</p>
 <h2>Stored records</h2>
 <p>Cancelling a booking changes its status; it does not erase its record. Some operational and audit records also remain after other records change. Deletion requests need a review of the relevant records and backups. There is no self-service account deletion in the current app.</p>
 <h2>Access, corrections and privacy questions</h2>
 <p>You can ask to access or correct your information. Start with your shop for its booking and customer records. For a Varello account, support record or privacy question, use the report form below and include a reply email. Ask to discuss the request without putting customer details, passwords or private links in the description.</p>
 <ReportTrigger/>
 <p><Link href="/beta-terms">Varello access terms</Link></p>
 </article></main>}
