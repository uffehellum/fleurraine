import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Home from './pages/Home';
import Flowers from './pages/Flowers';
import FlowerDetail from './pages/FlowerDetail';
import Garden from './pages/Garden';
import GardenRow from './pages/GardenRow';
import Bouquets from './pages/Bouquets';
import BouquetDetail from './pages/BouquetDetail';
import Orders from './pages/Orders';
import StandHistory from './pages/StandHistory';
import Subscribe from './pages/Subscribe';
import SignIn from './pages/SignIn';
import AuthCallback from './pages/AuthCallback';
import Forbidden from './pages/Forbidden';
import Bio from './pages/Bio';
import TerrysCorner from './pages/TerrysCorner';
import AdminPhotos from './pages/AdminPhotos';
import AdminPhotosList from './pages/AdminPhotosList';
import AdminQueue from './pages/AdminQueue';
import AdminAnalytics from './pages/AdminAnalytics';
import AdminOrders from './pages/AdminOrders';
import PhotoDetail from './pages/PhotoDetail';
import Season from './pages/Season';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout><Home /></Layout>} />
        <Route path="/flowers" element={<Layout><Flowers /></Layout>} />
        <Route path="/flowers/:id" element={<Layout><FlowerDetail /></Layout>} />
        <Route path="/garden" element={<Layout><Garden /></Layout>} />
        <Route path="/garden/:id" element={<Layout><GardenRow /></Layout>} />
        <Route path="/bouquets" element={<Layout><Bouquets /></Layout>} />
        <Route path="/bouquets/:id" element={<Layout><BouquetDetail /></Layout>} />
        <Route path="/orders" element={<ProtectedRoute><Layout><Orders /></Layout></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><Layout><StandHistory /></Layout></ProtectedRoute>} />
        <Route path="/subscribe" element={<Layout><Subscribe /></Layout>} />
        <Route path="/bio" element={<Layout><Bio /></Layout>} />
        <Route path="/terryscorner" element={<Layout><TerrysCorner /></Layout>} />
        <Route path="/signin" element={<Layout><SignIn /></Layout>} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/forbidden" element={<Layout><Forbidden /></Layout>} />
        <Route path="/season" element={<ProtectedRoute><Layout><Season /></Layout></ProtectedRoute>} />
        <Route path="/photos/:id" element={<ProtectedRoute><Layout><PhotoDetail /></Layout></ProtectedRoute>} />
        <Route path="/admin/photos" element={<AdminRoute><Layout><AdminPhotos /></Layout></AdminRoute>} />
        <Route path="/admin/photos/list" element={<AdminRoute><Layout><AdminPhotosList /></Layout></AdminRoute>} />
        <Route path="/admin/queue" element={<AdminRoute><Layout><AdminQueue /></Layout></AdminRoute>} />
        <Route path="/admin/analytics" element={<AdminRoute><Layout><AdminAnalytics /></Layout></AdminRoute>} />
        <Route path="/admin/orders" element={<AdminRoute><Layout><AdminOrders /></Layout></AdminRoute>} />
      </Routes>
    </BrowserRouter>
  );
}