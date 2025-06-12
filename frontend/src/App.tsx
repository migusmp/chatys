import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import ProtectedRoute from './components/ProtectedRoute'
import Loader from './components/Loader'
import Layout from './components/layout/Layout'

// Lazy load real de cada componente
const Home = lazy(() => import('./components/Home'))
const Login = lazy(() => import('./components/Login'))
const Register = lazy(() => import('./components/Register'))

function App() {

  return (
    <BrowserRouter>
      <Suspense fallback={<Loader />}>
        <Routes>
          {/* Rutas protegidas */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Home />} />
          </Route>

          {/* Rutas públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App