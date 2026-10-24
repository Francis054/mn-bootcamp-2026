import { Route, Routes } from 'react-router-dom';
import { RequireAccess } from '@/auth/AuthProvider';
import { AdminLayout } from '@/layouts/AdminLayout';
import { PublicLayout } from '@/layouts/PublicLayout';
import {
  AboutEditorPage,
  AccountPage,
  ContentEditorPage,
  MediaPage,
  SettingsPage,
  StatesPage,
  TimelineEditorPage,
  UsersPage,
} from '@/pages/admin/SystemPages';
import { ClassEditor, EventEditor, ProjectEditor, TraineeEditor } from '@/pages/admin/Editors';
import { ClassListPage, EventListPage, ProjectListPage, TraineeListPage } from '@/pages/admin/Lists';
import { OverviewPage } from '@/pages/admin/OverviewPage';
import { ForbiddenPage, ForgotPasswordPage, LoginPage, ResetPasswordPage, SessionExpiredPage } from '@/pages/auth/AuthPages';
import { AboutPage, AnniversaryPage, ContactPage, EventPage, EventsPage, GalleryPage, NotFoundPage, ProjectPage, ProjectsPage, TraineePage, TraineesPage } from '@/pages/public/CommunityPages';
import { HomePage } from '@/pages/public/HomePage';
import { BootcampPage, ClassesPage, JourneyPage, LessonPage } from '@/pages/public/ProgrammePages';

export function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} handle={{ page: 'home', tone: 'dark', title: 'Home' }} />
        <Route path="bootcamp" element={<BootcampPage />} handle={{ page: 'overview', tone: 'dark', title: 'Bootcamp' }} />
        <Route path="journey" element={<JourneyPage />} handle={{ page: 'journey', tone: 'light', title: 'Journey' }} />
        <Route path="classes" element={<ClassesPage />} handle={{ page: 'classes', tone: 'light', title: 'Classes' }} />
        <Route path="classes/:id" element={<LessonPage />} handle={{ page: 'classes', tone: 'light', title: 'Lesson' }} />
        <Route path="projects" element={<ProjectsPage />} handle={{ page: 'projects', tone: 'dark', title: 'Projects' }} />
        <Route path="projects/:id" element={<ProjectPage />} handle={{ page: 'projects', tone: 'light', title: 'Project' }} />
        <Route path="trainees" element={<TraineesPage />} handle={{ page: 'trainees', tone: 'light', title: 'Trainees' }} />
        <Route path="trainees/:id" element={<TraineePage />} handle={{ page: 'trainees', tone: 'light', title: 'Trainee' }} />
        <Route path="events" element={<EventsPage />} handle={{ page: 'events', tone: 'light', title: 'Events' }} />
        <Route path="events/:id" element={<EventPage />} handle={{ page: 'events', tone: 'light', title: 'Event' }} />
        <Route path="gallery" element={<GalleryPage />} handle={{ page: 'gallery', tone: 'light', title: 'Gallery' }} />
        <Route path="about" element={<AboutPage />} handle={{ page: 'about', tone: 'light', title: 'About' }} />
        <Route path="anniversary" element={<AnniversaryPage />} handle={{ page: 'anniversary', tone: 'dark', title: '10 Years' }} />
        <Route path="contact" element={<ContactPage />} handle={{ page: 'contact', tone: 'light', title: 'Contact' }} />
        <Route path="*" element={<NotFoundPage />} handle={{ page: '', tone: 'light', title: 'Not found' }} />
      </Route>
      <Route path="/admin/login" element={<LoginPage />} />
      <Route path="/admin/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/admin/reset-password" element={<ResetPasswordPage />} />
      <Route path="/admin/session-expired" element={<SessionExpiredPage />} />
      <Route path="/admin/forbidden" element={<ForbiddenPage />} />
      <Route path="/admin" element={<RequireAccess permission="content.read"><AdminLayout /></RequireAccess>}>
        <Route index element={<OverviewPage />} />
        <Route path="classes" element={<ClassListPage />} />
        <Route path="classes/new" element={<ClassEditor />} />
        <Route path="classes/:id" element={<ClassEditor />} />
        <Route path="trainees" element={<TraineeListPage />} />
        <Route path="trainees/new" element={<TraineeEditor />} />
        <Route path="trainees/:id" element={<TraineeEditor />} />
        <Route path="projects" element={<ProjectListPage />} />
        <Route path="projects/new" element={<ProjectEditor />} />
        <Route path="projects/:id" element={<ProjectEditor />} />
        <Route path="events" element={<EventListPage />} />
        <Route path="events/new" element={<EventEditor />} />
        <Route path="events/:id" element={<EventEditor />} />
        <Route path="media" element={<MediaPage />} />
        <Route path="content" element={<ContentEditorPage />} />
        <Route path="timeline" element={<TimelineEditorPage />} />
        <Route path="about" element={<AboutEditorPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="states" element={<StatesPage />} />
        <Route path="users" element={<RequireAccess permission="users.read"><UsersPage /></RequireAccess>} />
        <Route path="settings" element={<RequireAccess permission="settings.manage"><SettingsPage /></RequireAccess>} />
      </Route>
    </Routes>
  );
}
