import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/quizzes',
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/quizzes',
      name: 'quizzes',
      component: () => import('../views/QuizListView.vue'),
    },
    {
      path: '/quizzes/new',
      name: 'quiz-new',
      component: () => import('../views/SetupView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/quizzes/:id',
      name: 'quiz-detail',
      component: () => import('../views/SetupView.vue'),
    },
    {
      path: '/board',
      name: 'board',
      component: () => import('../views/BoardView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/quizzes',
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.initialized) await auth.init()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'quizzes' }
  }
  return true
})

export default router
