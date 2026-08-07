/** 侧边栏和"更多"面板共用 */
export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}
