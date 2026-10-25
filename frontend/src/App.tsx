import { lazy, Suspense, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RequireAccess } from '@/auth/AuthProvider';
import { AfterBoot, RouteFallback } from '@/components/Loader';
import { AdminLayout } from '@/layouts/AdminLayout';
import { PublicLayout } from '@/layouts/PublicLayout';

const AboutEditorPage = lazy(() => import('@/pages/admin/SystemPages').then((m) => ({ default: m.AboutEditorPage })));
const AccountPage = lazy(() => import('@/pages/admin/SystemPages').then((m) => ({ default: m.AccountPage })));
const ContentEditorPage = lazy(() => import('@/pages/admin/SystemPages').then((m) => ({ default: m.ContentEditorPage })));
const EnquiriesPage = lazy(() => import('@/pages/admin/SystemPages').then((m) => ({ default: m.EnquiriesPage })));
const MediaPage = lazy(() => import('@/pages/admin/SystemPages').then((m) => ({ default: m.MediaPage })));
const SettingsPage = lazy(() => import('@/pages/admin/SystemPages').then((m) => ({ default: m.SettingsPage })));
const StatesPage = lazy(() => import('@/pages/admin/SystemPages').then((m) => ({ default: m.StatesPage })));
const TimelineEditorPage = lazy(() => import('@/pages/admin/SystemPages').then((m) => ({ default: m.TimelineEditorPage })));
const UsersPage = lazy(() => import('@/pages/admin/SystemPages').then((m) => ({ default: m.UsersPage })));
const ClassEditor = lazy(() => import('@/pages/admin/Editors').then((m) => ({ default: m.ClassEditor })));
const EventEditor = lazy(() => import('@/pages/admin/Editors').then((m) => ({ default: m.EventEditor })));
const ProjectEditor = lazy(() => import('@/pages/admin/Editors').then((m) => ({ default: m.ProjectEditor })));
const TraineeEditor = lazy(() => import('@/pages/admin/Editors').then((m) => ({ default: m.TraineeEditor })));
const ClassListPage = lazy(() => import('@/pages/admin/Lists').then((m) => ({ default: m.ClassListPage })));
const EventListPage = lazy(() => import('@/pages/admin/Lists').then((m) => ({ default: m.EventListPage })));
const ProjectListPage = lazy(() => import('@/pages/admin/Lists').then((m) => ({ default: m.ProjectListPage })));
const TraineeListPage = lazy(() => import('@/pages/admin/Lists').then((m) => ({ default: m.TraineeListPage })));
const OverviewPage = lazy(() => import('@/pages/admin/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const ForbiddenPage = lazy(() => import('@/pages/auth/AuthPages').then((m) => ({ default: m.ForbiddenPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/AuthPages').then((m) => ({ default: m.ForgotPasswordPage })));
const LoginPage = lazy(() => import('@/pages/auth/AuthPages').then((m) => ({ default: m.LoginPage })));
const ResetPasswordPage = lazy(() => import('@/pages/auth/AuthPages').then((m) => ({ default: m.ResetPasswordPage })));
const SessionExpiredPage = lazy(() => import('@/pages/auth/AuthPages').then((m) => ({ default: m.SessionExpiredPage })));
const AboutPage = lazy(() => import('@/pages/public/CommunityPages').then((m) => ({ default: m.AboutPage })));
const AnniversaryPage = lazy(() => import('@/pages/public/CommunityPages').then((m) => ({ default: m.AnniversaryPage })));
const ContactPage = lazy(() => import('@/pages/public/CommunityPages').then((m) => ({ default: m.ContactPage })));
const EventPage = lazy(() => import('@/pages/public/CommunityPages').then((m) => ({ default: m.EventPage })));
const EventsPage = lazy(() => import('@/pages/public/CommunityPages').then((m) => ({ default: m.EventsPage })));
const GalleryPage = lazy(() => import('@/pages/public/CommunityPages').then((m) => ({ default: m.GalleryPage })));
const NotFoundPage = lazy(() => import('@/pages/public/CommunityPages').then((m) => ({ default: m.NotFoundPage })));
const ProjectPage = lazy(() => import('@/pages/public/CommunityPages').then((m) => ({ default: m.ProjectPage })));
const ProjectsPage = lazy(() => import('@/pages/public/CommunityPages').then((m) => ({ default: m.ProjectsPage })));
const TraineePage = lazy(() => import('@/pages/public/CommunityPages').then((m) => ({ default: m.TraineePage })));
const TraineesPage = lazy(() => import('@/pages/public/CommunityPages').then((m) => ({ default: m.TraineesPage })));
const HomePage = lazy(() => import('@/pages/public/HomePage').then((m) => ({ default: m.HomePage })));
const BootcampPage = lazy(() => import('@/pages/public/ProgrammePages').then((m) => ({ default: m.BootcampPage })));
const ClassesPage = lazy(() => import('@/pages/public/ProgrammePages').then((m) => ({ default: m.ClassesPage })));
const JourneyPage = lazy(() => import('@/pages/public/ProgrammePages').then((m) => ({ default: m.JourneyPage })));
const LessonPage = lazy(() => import('@/pages/public/ProgrammePages').then((m) => ({ default: m.LessonPage })));
const WorkstationPage = lazy(() => import('@/pages/public/WorkstationPage').then((m) => ({ default: m.WorkstationPage })));

function Waiting({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <AfterBoot>{children}</AfterBoot>
    </Suspense>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/workstation" element={<Waiting><WorkstationPage /></Waiting>} />
      <Route element={<PublicLayout />}>
        <Route index element={<Waiting><HomePage /></Waiting>} handle={{ page: 'home', tone: 'dark', title: 'Home' }} />
        <Route path="bootcamp" element={<Waiting><BootcampPage /></Waiting>} handle={{ page: 'overview', tone: 'dark', title: 'Bootcamp' }} />
        <Route path="journey" element={<Waiting><JourneyPage /></Waiting>} handle={{ page: 'journey', tone: 'light', title: 'Journey' }} />
        <Route path="classes" element={<Waiting><ClassesPage /></Waiting>} handle={{ page: 'classes', tone: 'light', title: 'Classes' }} />
        <Route path="classes/:id" element={<Waiting><LessonPage /></Waiting>} handle={{ page: 'classes', tone: 'light', title: 'Lesson' }} />
        <Route path="projects" element={<Waiting><ProjectsPage /></Waiting>} handle={{ page: 'projects', tone: 'dark', title: 'Projects' }} />
        <Route path="projects/:id" element={<Waiting><ProjectPage /></Waiting>} handle={{ page: 'projects', tone: 'light', title: 'Project' }} />
        <Route path="trainees" element={<Waiting><TraineesPage /></Waiting>} handle={{ page: 'trainees', tone: 'light', title: 'Trainees' }} />
        <Route path="trainees/:id" element={<Waiting><TraineePage /></Waiting>} handle={{ page: 'trainees', tone: 'light', title: 'Trainee' }} />
        <Route path="events" element={<Waiting><EventsPage /></Waiting>} handle={{ page: 'events', tone: 'light', title: 'Events' }} />
        <Route path="events/:id" element={<Waiting><EventPage /></Waiting>} handle={{ page: 'events', tone: 'light', title: 'Event' }} />
        <Route path="gallery" element={<Waiting><GalleryPage /></Waiting>} handle={{ page: 'gallery', tone: 'light', title: 'Gallery' }} />
        <Route path="about" element={<Waiting><AboutPage /></Waiting>} handle={{ page: 'about', tone: 'light', title: 'About' }} />
        <Route path="anniversary" element={<Waiting><AnniversaryPage /></Waiting>} handle={{ page: 'anniversary', tone: 'dark', title: '10 Years' }} />
        <Route path="contact" element={<Waiting><ContactPage /></Waiting>} handle={{ page: 'contact', tone: 'light', title: 'Contact' }} />
        <Route path="*" element={<Waiting><NotFoundPage /></Waiting>} handle={{ page: '', tone: 'light', title: 'Not found' }} />
      </Route>
      <Route path="/admin/login" element={<Waiting><LoginPage /></Waiting>} />
      <Route path="/admin/forgot-password" element={<Waiting><ForgotPasswordPage /></Waiting>} />
      <Route path="/admin/reset-password" element={<Waiting><ResetPasswordPage /></Waiting>} />
      <Route path="/admin/session-expired" element={<Waiting><SessionExpiredPage /></Waiting>} />
      <Route path="/admin/forbidden" element={<Waiting><ForbiddenPage /></Waiting>} />
      <Route path="/admin" element={<RequireAccess permission="content.read"><AdminLayout /></RequireAccess>}>
        <Route index element={<Waiting><OverviewPage /></Waiting>} />
        <Route path="classes" element={<Waiting><ClassListPage /></Waiting>} />
        <Route path="classes/new" element={<Waiting><ClassEditor /></Waiting>} />
        <Route path="classes/:id" element={<Waiting><ClassEditor /></Waiting>} />
        <Route path="trainees" element={<Waiting><TraineeListPage /></Waiting>} />
        <Route path="trainees/new" element={<Waiting><TraineeEditor /></Waiting>} />
        <Route path="trainees/:id" element={<Waiting><TraineeEditor /></Waiting>} />
        <Route path="projects" element={<Waiting><ProjectListPage /></Waiting>} />
        <Route path="projects/new" element={<Waiting><ProjectEditor /></Waiting>} />
        <Route path="projects/:id" element={<Waiting><ProjectEditor /></Waiting>} />
        <Route path="events" element={<Waiting><EventListPage /></Waiting>} />
        <Route path="events/new" element={<Waiting><EventEditor /></Waiting>} />
        <Route path="events/:id" element={<Waiting><EventEditor /></Waiting>} />
        <Route path="media" element={<Waiting><MediaPage /></Waiting>} />
        <Route path="content" element={<Waiting><ContentEditorPage /></Waiting>} />
        <Route path="timeline" element={<Waiting><TimelineEditorPage /></Waiting>} />
        <Route path="about" element={<Waiting><AboutEditorPage /></Waiting>} />
        <Route path="account" element={<Waiting><AccountPage /></Waiting>} />
        <Route path="states" element={<Waiting><StatesPage /></Waiting>} />
        <Route path="users" element={<Waiting><RequireAccess permission="users.read"><UsersPage /></RequireAccess></Waiting>} />
        <Route path="enquiries" element={<Waiting><RequireAccess permission="users.manage"><EnquiriesPage /></RequireAccess></Waiting>} />
        <Route path="settings" element={<Waiting><RequireAccess permission="settings.manage"><SettingsPage /></RequireAccess></Waiting>} />
      </Route>
    </Routes>
  );
}
