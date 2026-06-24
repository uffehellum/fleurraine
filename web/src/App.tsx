import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import { InstallPrompt } from "./components/InstallPrompt";
import Home from "./pages/Home";
import StandHistory from "./pages/StandHistory";
import Flowers from "./pages/Flowers";
import FlowerDetail from "./pages/FlowerDetail";
import Garden from "./pages/Garden";
import GardenRow from "./pages/GardenRow";
import Bouquets from "./pages/Bouquets";
import Season from "./pages/Season";
import Orders from "./pages/Orders";
import Subscribe from "./pages/Subscribe";
import AdminQueue from "./pages/AdminQueue";
import AdminOrders from "./pages/AdminOrders";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminPhotos from "./pages/AdminPhotos";
import SignIn from "./pages/SignIn";
import AuthCallback from "./pages/AuthCallback";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <InstallPrompt />
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/stand/history" element={<StandHistory />} />
            <Route path="/flowers" element={<Flowers />} />
            <Route path="/flowers/:name" element={<FlowerDetail />} />
            <Route path="/garden" element={<Garden />} />
            <Route path="/garden/:row" element={<GardenRow />} />
            <Route path="/bouquets" element={<Bouquets />} />
            <Route path="/season" element={<Season />} />
            <Route path="/sign-in" element={<SignIn />} />
            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <Orders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/subscribe"
              element={
                <ProtectedRoute>
                  <Subscribe />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/queue"
              element={
                <AdminRoute>
                  <AdminQueue />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/orders"
              element={
                <AdminRoute>
                  <AdminOrders />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <AdminRoute>
                  <AdminAnalytics />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/photos"
              element={
                <AdminRoute>
                  <AdminPhotos />
                </AdminRoute>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
