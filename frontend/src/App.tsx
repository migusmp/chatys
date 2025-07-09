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

const AccountSettings = lazy(() => import('./components/pages/settings/components/desktop/AccountSettings'))
const SelectLanguage = lazy(() => import('./components/pages/settings/components/desktop/SelectLanguage'))
const SelectTheme = lazy(() => import('./components/pages/settings/components/desktop/SelectTheme'))

const DmRoom = lazy(() => import('./components/pages/dm/components/DmRoom/DmRoom'));
const DmList = lazy(() => import('./components/pages/dm/components/DmList'));


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

            <Route path="/dm" element={<DirectMessages />}>
              <Route index element={<DmList />} />
              {/* Ruta para el chat individual */}
              <Route path=":username" element={<DmRoom />} />
            </Route>

            <Route path="/notifications" element={<Notifications />} />

            <Route path="/profile/:username" element={<Profile />}>
              <Route index element={<PostsProfile />} />
              <Route path="friends" element={<FriendsProfile />} />
            </Route>

            <Route path="/settings" element={<Settings />}>
              <Route index element={<AccountSettings />} />
              <Route path="account" element={<AccountSettings />} />
              <Route path="language" element={<SelectLanguage />} />
              <Route path="theme" element={<SelectTheme />} />
            </Route>
          </Route>

          {/* Rutas públicas */}
          <Route
            path="/login"
            element={
              <ProtectedRoute>
                <Login />
              </ProtectedRoute>
            }
          />

          <Route
            path="/register"
            element={
              <ProtectedRoute>
                <Register />
              </ProtectedRoute>
            }
          />

          {/* Página 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App