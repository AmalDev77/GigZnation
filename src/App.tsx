import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import HomePage from "@/pages/Home";
import Discover from "@/pages/Discover";
import Bookings from "@/pages/Bookings";
import Messages from "@/pages/Messages";
import Profile from "@/pages/Profile";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import NotFound from "@/pages/NotFound";
import Welcome from "@/pages/Welcome";
import PhoneOTP from "@/pages/PhoneOTP";
import RoleSelection from "@/pages/RoleSelection";
import ArtistProfile from "@/pages/ArtistProfile";
import ArtistPublicProfile from "@/pages/ArtistPublicProfile";
import VenueProfile from "@/pages/VenueProfile";
import VenuePublicProfile from "@/pages/VenuePublicProfile";
import BookArtist from "@/pages/BookArtist";
import BookingDetail from "@/pages/BookingDetail";
import VenueBookingDetail from "@/pages/VenueBookingDetail";
import Payment from "@/pages/Payment";
import PaymentSuccess from "@/pages/PaymentSuccess";
import RateReview from "@/pages/RateReview";
import ChatThread from "@/pages/ChatThread";
import Notifications from "@/pages/Notifications";
import SettingsPage from "@/pages/Settings";
import PostGig from "@/pages/PostGig";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminVerification from "@/pages/admin/AdminVerification";
import AdminBookings from "@/pages/admin/AdminBookings";
import AdminDisputes from "@/pages/admin/AdminDisputes";
import AdminAnalytics from "@/pages/admin/AdminAnalytics";
import AdminFeatureFlags from "@/pages/admin/AdminFeatureFlags";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminBlockedUsers from "@/pages/admin/AdminBlockedUsers";
import AdminWarnings from "@/pages/admin/AdminWarnings";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminArtistReviews from "@/pages/admin/AdminArtistReviews";
import AdminVenueReviews from "@/pages/admin/AdminVenueReviews";
import AdminBlocksWarnings from "@/pages/admin/AdminBlocksWarnings";
import AdminAuditLog from "@/pages/admin/AdminAuditLog";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/phone" element={<PhoneOTP />} />
          <Route path="/role-selection" element={<RoleSelection />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/artist-profile" element={<ArtistProfile />} />
          <Route path="/artist/:id" element={<ArtistPublicProfile />} />
          <Route path="/artist/:id/book" element={<BookArtist />} />
          <Route path="/venue-profile" element={<VenueProfile />} />
          <Route path="/venue/:id" element={<VenuePublicProfile />} />
          <Route path="/booking/:bookingId" element={<BookingDetail />} />
          <Route path="/venue-booking/:bookingId" element={<VenueBookingDetail />} />
          <Route path="/payment/:bookingId" element={<Payment />} />
          <Route path="/payment-success/:bookingId" element={<PaymentSuccess />} />
          <Route path="/review/:bookingId" element={<RateReview />} />
          <Route path="/chat/:bookingId" element={<ChatThread />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/post-gig" element={<PostGig />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          {/* Super Admin */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="verification" element={<AdminVerification />} />
            <Route path="bookings" element={<AdminBookings />} />
            <Route path="disputes" element={<AdminDisputes />} />
            <Route path="blocked-users" element={<AdminBlocksWarnings />} />
            <Route path="blocks" element={<AdminBlocksWarnings />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="feature-flags" element={<AdminFeatureFlags />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="artist-reviews" element={<AdminArtistReviews />} />
            <Route path="venue-reviews" element={<AdminVenueReviews />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="audit-log" element={<AdminAuditLog />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
