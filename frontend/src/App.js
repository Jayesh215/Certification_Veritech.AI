import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdminLayout from "@/components/AdminLayout";
import { RegistrationProvider } from "@/context/RegistrationContext";

import Landing from "@/pages/Landing";
import Register from "@/pages/Register";
import Review from "@/pages/Review";
import Payment from "@/pages/Payment";
import Success from "@/pages/Success";
import Failed from "@/pages/Failed";
import Status from "@/pages/Status";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminRegistrations from "@/pages/AdminRegistrations";
import AdminPayments from "@/pages/AdminPayments";
import AdminCertificates from "@/pages/AdminCertificates";
import Verify from "@/pages/Verify";

function Shell({ children }) {
  const loc = useLocation();
  const isAdmin = loc.pathname.startsWith("/admin");
  const isVerify = loc.pathname.startsWith("/verify");
  const hideChrome = isAdmin || isVerify;
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {!hideChrome && <Header />}
      <div className="flex-1">{children}</div>
      {!hideChrome && <Footer />}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <RegistrationProvider>
        <Toaster position="top-right" richColors closeButton />
        <Shell>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/register" element={<Register />} />
            <Route path="/register/:internId" element={<Register />} />
            <Route path="/review" element={<Review />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/success" element={<Success />} />
            <Route path="/failed" element={<Failed />} />
            <Route path="/status" element={<Status />} />
            <Route path="/verify/:certNumber" element={<Verify />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="registrations" element={<AdminRegistrations />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="certificates" element={<AdminCertificates />} />
            </Route>
          </Routes>
        </Shell>
      </RegistrationProvider>
    </BrowserRouter>
  );
}

export default App;
