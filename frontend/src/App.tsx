import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import ProtectedRoute from './components/ProtectedRoute'
import Loader from './components/Loader'
import Layout from './components/layout/Layout'

// Lazy load real de cada componente
const Home = lazy(() => import('./components/pages/home/Home'))
const Login = lazy(() => import('./components/pages/login/Login'))
const Register = lazy(() => import('./components/pages/register/Register'))

const Friends = lazy(() => import('./components/pages/friends/Friends'))
const Chats = lazy(() => import('./components/pages/chats/Chats'))

const DirectMessages = lazy(() => import('./components/pages/dm/DirectMessages'))
const Notifications = lazy(() => import('./components/pages/notifications/Notifications'))
const Profile = lazy(() => import('./components/pages/profile/Profile'))
const Settings = lazy(() => import('./components/pages/settings/Settings'))

const FriendsProfile = lazy(() => import('./components/pages/profile/components/Friends'))
const PostsProfile = lazy(() => import('./components/pages/profile/components/PostsProfileSection'))

const NotFound = lazy(() => import('./components/NotFound'))

function App() {

  return (
    <BrowserRouter>
      <Suspense fallback={<Loader />}>
        <Routes>
          {/* Rutas protegidas */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Home />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/chats" element={<Chats />} />
            <Route path="/dm" element={<DirectMessages />} />
            <Route path="/notifications" element={<Notifications />} />

            <Route path="/profile/:username" element={<Profile />}>
              <Route index element={<PostsProfile />} />
              <Route path="friends" element={<FriendsProfile />} />
            </Route>

            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* Rutas públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Página 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App