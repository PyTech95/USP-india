import "@/App.css";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation, useNavigationType } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { SiteProvider } from "./lib/site";
import { AuthProvider, RequireAuth } from "./lib/auth";
import PublicLayout from "./components/public/PublicLayout";
import PageView from "./pages/public/PageView";
import FieldNotesIndex from "./pages/public/FieldNotesIndex";
import FieldNoteView from "./pages/public/FieldNoteView";
import NotFound from "./pages/public/NotFound";
import Login from "./pages/admin/Login";
import TokenPassword from "./pages/admin/TokenPassword";
import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import PagesList from "./pages/admin/PagesList";
import PageEditor from "./pages/admin/PageEditor";
import NotesList from "./pages/admin/NotesList";
import NoteEditor from "./pages/admin/NoteEditor";
import MediaLibrary from "./pages/admin/MediaLibrary";
import Menus from "./pages/admin/Menus";
import Appearance from "./pages/admin/Appearance";
import Enquiries from "./pages/admin/Enquiries";
import Seo from "./pages/admin/Seo";
import Users from "./pages/admin/Users";
import Settings from "./pages/admin/Settings";
import ImportExport from "./pages/admin/ImportExport";
import EnquirySettings from "./pages/admin/EnquirySettings";
import Traffic from "./pages/admin/Traffic";
import { PagePreview, NotePreview } from "./pages/admin/Previews";

const CHILDREN = ["rakhigarhi", "theatre", "craft-livelihood", "workshops-learning"];

function WorkChild() {
  const { child } = useParams();
  return CHILDREN.includes(child) ? <PageView pageKey={child} key={child} /> : <NotFound />;
}

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const nav = useNavigationType();
  useEffect(() => {
    if (nav !== "POP" && !hash) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  return null;
}

function App() {
  return (
    <AuthProvider>
      <SiteProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<PageView pageKey="home" key="home" />} />
              <Route path="/about" element={<PageView pageKey="about" key="about" />} />
              <Route path="/our-work" element={<Navigate to="/" replace />} />
              <Route path="/our-work/:child" element={<WorkChild />} />
              <Route path="/field-notes" element={<FieldNotesIndex />} />
              <Route path="/field-notes/:slug" element={<FieldNoteView />} />
              <Route path="/connect" element={<PageView pageKey="connect" key="connect" />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route path="/admin/login" element={<Login />} />
            <Route path="/admin/reset-password" element={<TokenPassword kind="reset" />} />
            <Route path="/admin/accept-invite" element={<TokenPassword kind="invite" />} />
            <Route element={<RequireAuth><PublicLayout preview /></RequireAuth>}>
              <Route path="/admin/preview/page/:key" element={<PagePreview />} />
              <Route path="/admin/preview/note/:id" element={<NotePreview />} />
            </Route>
            <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
              <Route index element={<Dashboard />} />
              <Route path="pages" element={<PagesList />} />
              <Route path="pages/:key" element={<PageEditor />} />
              <Route path="field-notes" element={<NotesList />} />
              <Route path="field-notes/:id" element={<NoteEditor />} />
              <Route path="media" element={<MediaLibrary />} />
              <Route path="menus" element={<Menus />} />
              <Route path="appearance" element={<Appearance />} />
              <Route path="enquiries" element={<Enquiries />} />
              <Route path="enquiries/settings" element={<EnquirySettings />} />
              <Route path="traffic" element={<Traffic />} />
              <Route path="seo" element={<Seo />} />
              <Route path="users" element={<Users />} />
              <Route path="settings" element={<Settings />} />
              <Route path="transfer" element={<ImportExport />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="bottom-right" />
      </SiteProvider>
    </AuthProvider>
  );
}

export default App;
