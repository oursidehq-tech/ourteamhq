import { useEffect } from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { Sparkles, Users, CalendarDays, BadgeCheck, ShoppingBag, MessageCircle, TrendingUp, ArrowRight, PlayCircle, ChevronRight } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ClubProvider } from './context/ClubContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ClubsPage from './pages/ClubsPage';
import MembersPage from './pages/MembersPage';
import TeamsPage from './pages/TeamsPage';
import GroupsPage from './pages/GroupsPage';
import PostsPage from './pages/PostsPage';
import EventsPage from './pages/EventsPage';
import ProductsPage from './pages/ProductsPage';
import OrdersPage from './pages/OrdersPage';
import TasksPage from './pages/TasksPage';
import RostersPage from './pages/RostersPage';
import TradesPage from './pages/TradesPage';
import NotificationsPage from './pages/NotificationsPage';
import SettingsPage from './pages/SettingsPage';
import UsersPage from './pages/UsersPage';
import ReportsPage from './pages/ReportsPage';
import LeaguePlatform from './pages/LeaguePlatform';
import Compliance from './pages/Compliance';
import TrainingCenter from './pages/TrainingCenter';
import BookingManager from './pages/BookingManager';
import FinanceReport from './pages/FinanceReport';
import SponsorsPage from './pages/SponsorsPage';
import AuditLogsPage from './pages/AuditLogsPage';

const TERMS_OF_SERVICE = `OURSIDEHQ TERMS OF SERVICE
Effective Date

These Terms of Service govern access to and use of the OurSideHQ platform, including the website, mobile applications and related services ("Platform").

By accessing or using OurSideHQ, you agree to these Terms.

If you do not agree to these Terms, you must not use the Platform.

1. About OurSideHQ

OurSideHQ is a software platform designed to assist sporting clubs, associations, organisations, volunteers, players, parents, guardians, sponsors and other users in managing community sport activities.

OurSideHQ provides tools including but not limited to:

Club management
Team management
Group management
Communication tools
Rostering
Tasks
Compliance management
Training resources
Sponsor management
Club stores
Calendars and scheduling
2. User Accounts

Users may create an account directly or receive access through a club, organisation or sponsor invitation.

Users are responsible for:

Maintaining accurate information
Protecting account credentials
Ensuring account activity remains secure

Users must immediately notify OurSideHQ of any unauthorised use.

3. Child Accounts

Many users of OurSideHQ are minors.

Parents or legal guardians are responsible for:

Creating or managing child accounts
Providing consent where required
Ensuring information submitted is accurate

OurSideHQ does not knowingly allow children to create accounts without appropriate parental or guardian involvement.

4. Club and Organisation Administrators

Club and Organisation Administrators are responsible for:

Managing user access
Maintaining accurate records
Managing compliance requirements
Approving content where applicable

Administrators must ensure all information entered complies with applicable laws and regulations.

5. Sponsor Accounts

Sponsors may be granted access to maintain their sponsor profile.

Sponsors may:

Update business information
Upload content
Submit promotions

Sponsors may not:

Access member data
Access player data
Access club administration areas
Access compliance records

Sponsor promotions displayed on club feeds are subject to approval by the relevant club.

6. Acceptable Use

Users must not:

Break any law
Upload offensive content
Harass users
Impersonate others
Upload malicious software
Attempt unauthorised access

OurSideHQ may suspend or terminate accounts that breach these rules.

7. Compliance Documents

Clubs may collect compliance information through the Platform.

Examples include:

Blue Cards
First Aid Certificates
Coaching Accreditation
Medical information

OurSideHQ stores information on behalf of clubs and organisations.

Clubs remain responsible for ensuring information collected is appropriate and lawful.

8. Club Store

Clubs may operate stores through the Platform.

OurSideHQ is not the seller of products unless expressly stated.

Purchases made through a club store are agreements between the purchaser and the relevant club.

9. Intellectual Property

All software, branding, content and intellectual property associated with OurSideHQ remain the property of OurSideHQ unless otherwise stated.

Users retain ownership of content they upload.

By uploading content, users grant OurSideHQ a licence to store, display and process that content for operation of the Platform.

10. Availability

We aim to provide reliable access but do not guarantee uninterrupted availability.

Services may be modified, suspended or discontinued at any time.

11. Limitation of Liability

To the maximum extent permitted by law:

OurSideHQ is not liable for:

Loss of data
Loss of profits
Business interruption
Indirect or consequential losses

Liability is limited to the amount paid by the customer during the previous twelve months.

12. Termination

We may suspend or terminate access where:

These Terms are breached
Security concerns arise
Required by law

Users may stop using the Platform at any time.

13. Governing Law

These Terms are governed by the laws of Queensland, Australia.`;

const PRIVACY_POLICY = `OURSIDEHQ PRIVACY POLICY
Effective Date

This Privacy Policy explains how OurSideHQ collects, uses and protects personal information.

1. Information We Collect

We may collect:

Identity Information
Name
Date of birth
Email address
Phone number
Club Information
Team membership
Roles
Volunteer positions
Participation records
Compliance Information
Blue Card details
Accreditation details
First Aid qualifications
Other compliance records
Sponsor Information
Business details
Contact information
Sponsor content
Store Information
Orders
Transaction history
Delivery information
Technical Information
Device information
IP address
Browser information
Usage analytics
2. How We Use Information

We use information to:

Operate the Platform
Manage teams and clubs
Provide communications
Manage compliance
Process transactions
Improve services
Provide customer support
3. Children's Information

Where information relates to children:

Data is generally provided by parents or guardians
Clubs are responsible for ensuring appropriate permissions are obtained
We take additional care in handling information relating to minors
4. Sharing Information

We may share information with:

Clubs

Information relevant to club administration.

Organisations

Information relevant to competition management.

Service Providers

Technology providers supporting the Platform.

Legal Requirements

Where required by law.

We do not sell personal information.

5. Data Security

We implement reasonable technical and organisational measures to protect information.

However, no system can guarantee absolute security.

6. Data Retention

Information is retained only as long as necessary to:

Provide services
Meet legal obligations
Resolve disputes
Enforce agreements
7. Access and Correction

Users may request access to personal information held about them.

Users may also request corrections where information is inaccurate.

8. Marketing

Sponsor promotions and club communications may be delivered through the Platform.

Users may opt out of certain marketing communications where permitted.

9. International Data Transfers

Information may be processed by cloud service providers located outside Australia.

Reasonable safeguards will be implemented where required.

10. Contact

Privacy enquiries may be directed to:

OurSideHQ
Email: admin@oursidehq.com.au
Website: oursidehq.com.au`;

function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const features = [
    {
      icon: <Users size={22} />,
      title: 'Club Management',
      text: 'Manage clubs, members, roles, and permissions with a clean operational dashboard.'
    },
    {
      icon: <CalendarDays size={22} />,
      title: 'Scheduling',
      text: 'Coordinate matches, training sessions, and events with unified calendar tools.'
    },
    {
      icon: <BadgeCheck size={22} />,
      title: 'Compliance',
      text: 'Track Blue Cards, First Aid, accreditations, and other critical certifications.'
    },
    {
      icon: <MessageCircle size={22} />,
      title: 'Communication',
      text: 'Keep players, parents, coaches, and admins aligned with announcements and updates.'
    },
    {
      icon: <ShoppingBag size={22} />,
      title: 'Club Store',
      text: 'Run merchandise and fundraising stores with streamlined product and order tools.'
    },
    {
      icon: <TrendingUp size={22} />,
      title: 'Reporting',
      text: 'See operational activity, finance, training, and engagement metrics in one place.'
    }
  ];

  const steps = [
    'Launch the portal and connect your club profile.',
    'Invite members, staff, and families with role-based access.',
    'Run your club day-to-day from one branded workspace.'
  ];

  return (
    <div className="landing-shell">
      <header className="landing-nav">
        <div className="landing-brand">
          <div className="landing-brand-mark">
            <img src="/icon.png" alt="OurSideHQ logo" />
          </div>
          <div>
            <strong>OurSideHQ</strong>
            <span>Sports club management platform</span>
          </div>
        </div>

        <nav className="landing-links">
          <a href="#features">Features</a>
          <a href="#about">About</a>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </nav>

        <div className="landing-actions">
          <button className="landing-secondary" onClick={() => navigate('/login')}>
            Login <ChevronRight size={16} />
          </button>
          <button className="landing-primary" onClick={() => navigate('/login')}>
            Open Admin <ArrowRight size={16} />
          </button>
        </div>
      </header>

      <main>
        <section className="hero-section" id="home">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={14} /> Built for modern sports clubs</span>
            <h1>The elite operating system for community sport</h1>
            <p>
              Run membership, compliance, communication, scheduling, store sales, and reporting from one polished platform.
            </p>
            <div className="hero-cta">
              <button className="landing-primary" onClick={() => navigate('/login')}>
                Open Admin Portal <ArrowRight size={16} />
              </button>
              <button className="landing-secondary ghost" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
                <PlayCircle size={16} /> Watch Overview
              </button>
            </div>
            <div className="hero-points">
              <span>Admin-ready</span>
              <span>Member-friendly</span>
              <span>Mobile-responsive</span>
            </div>
          </div>

          <div className="hero-card">
            <div className="hero-card-top">
              <div>
                <p>Live club snapshot</p>
                <h2>Everything in one dashboard</h2>
              </div>
              <div className="pulse-dot" />
            </div>
            <div className="hero-stat-grid">
              <div><strong>248</strong><span>Members</span></div>
              <div><strong>18</strong><span>Teams</span></div>
              <div><strong>94%</strong><span>Compliance</span></div>
              <div><strong>36</strong><span>Events</span></div>
            </div>
            <div className="hero-card-list">
              <div><span className="dot success" /> Training sessions are fully staffed.</div>
              <div><span className="dot warning" /> 3 renewals need attention this week.</div>
              <div><span className="dot info" /> New sponsor offer approved for publishing.</div>
            </div>
          </div>
        </section>

        <section className="logo-strip">
          <span>Trusted by clubs, associations, volunteers, and families</span>
        </section>

        <section className="feature-section" id="features">
          <div className="section-heading">
            <span>Platform features</span>
            <h2>Designed to replace scattered tools with one cohesive experience</h2>
            <p>Everything is tuned for operational clarity, strong hierarchy, and fast actions on desktop and mobile.</p>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature-tile" key={feature.title}>
                <div className="feature-icon-wrap">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="split-section" id="about">
          <div className="section-heading left">
            <span>About OurSideHQ</span>
            <h2>A platform built for real club operations</h2>
            <p>
              OurSideHQ supports sporting clubs, associations, volunteers, players, parents, guardians, and sponsors with a single workflow.
            </p>
          </div>
          <div className="steps-card">
            {steps.map((step, index) => (
              <div className="step-row" key={step}>
                <div className="step-index">0{index + 1}</div>
                <p>{step}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="contact-section" id="contact">
          <div className="contact-card">
            <div>
              <span>Contact</span>
              <h2>Ready to roll out the admin portal?</h2>
              <p>Open the login screen to access the admin dashboard or start onboarding a club workspace.</p>
            </div>
            <button className="landing-primary" onClick={() => navigate('/login')}>
              Go to Login <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function PolicyPage({ title, heading, body }) {
  return (
    <div className="policy-page-shell">
      <div className="policy-page-header">
        <div className="landing-brand policy-brand">
          <div className="landing-brand-mark">
            <img src="/icon.png" alt="OurSideHQ logo" />
          </div>
          <div>
            <strong>OurSideHQ</strong>
            <span>Sports club management platform</span>
          </div>
        </div>
        <Link className="policy-back-link" to="/">Back to Home</Link>
      </div>

      <main className="policy-page-main">
        <section className="policy-page-hero">
          <span className="eyebrow">{title}</span>
          <h1>{heading}</h1>
        </section>

        <section className="policy-card policy-page-card">
          <pre className="policy-pre">{body}</pre>
        </section>
      </main>
    </div>
  );
}

// Standalone User Portal Pages
import UserFeed from './pages/UserFeed';
import UserTeams from './pages/UserTeams';
import UserGroups from './pages/UserGroups';
import UserCalendar from './pages/UserCalendar';
import UserShop from './pages/UserShop';
import UserOrders from './pages/UserOrders';
import UserTasks from './pages/UserTasks';
import UserTraining from './pages/UserTraining';
import UserProfile from './pages/UserProfile';
import ClubInfo from './pages/ClubInfo';

function ProtectedRoutes() {
  const { isAuthenticated, loading, portalMode } = useAuth();
  if (loading) return <div className="login-page"><p>Loading…</p></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <ClubProvider>
      <Routes>
        <Route element={<Layout />}>
          {/* Dashboard route dynamically switches based on portalMode */}
          <Route path="dashboard" element={portalMode === 'admin' ? <Dashboard /> : <UserFeed />} />
          <Route index element={<Navigate to="dashboard" replace />} />
          
          {/* Admin Specific Routes */}
          <Route path="clubs" element={<ClubsPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="posts" element={<PostsPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="rosters" element={<RostersPage />} />
          <Route path="trades" element={<TradesPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="league-platform" element={<LeaguePlatform />} />
          <Route path="compliance" element={<Compliance />} />
          <Route path="training-center" element={<TrainingCenter />} />
          <Route path="bookings" element={<BookingManager />} />
          <Route path="finance" element={<FinanceReport />} />
          <Route path="sponsors" element={<SponsorsPage />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />

          {/* Standalone Member Portal Routes */}
          <Route path="user-teams" element={<UserTeams />} />
          <Route path="user-groups" element={<UserGroups />} />
          <Route path="user-calendar" element={<UserCalendar />} />
          <Route path="user-shop" element={<UserShop />} />
          <Route path="my-orders" element={<UserOrders />} />
          <Route path="user-tasks" element={<UserTasks />} />
          <Route path="user-training" element={<UserTraining />} />
          <Route path="user-profile" element={<UserProfile />} />
          <Route path="club-info" element={<ClubInfo />} />
        </Route>
      </Routes>
    </ClubProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={<PolicyPage title="Privacy Policy" heading="How OurSideHQ handles personal information" body={PRIVACY_POLICY} />} />
        <Route path="/terms" element={<PolicyPage title="Terms of Service" heading="How OurSideHQ can be used" body={TERMS_OF_SERVICE} />} />
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </AuthProvider>
  );
}
