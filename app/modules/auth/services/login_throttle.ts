import limiter from '@adonisjs/limiter/services/main'
import { AppException } from '#shared/exceptions/app_exception'

/**
 * Failed-login budget (docs/backend/04 §2, 05 §8): 10 / 15 min per IP and
 * 5 / 15 min per e-mail. Only failures consume it; a success clears the e-mail key.
 */
const byIp = () => limiter.use({ requests: 10, duration: '15 mins' })
const byEmail = () => limiter.use({ requests: 5, duration: '15 mins' })

export class LoginThrottle {
  async assertAllowed(ip: string, email: string) {
    for (const [store, key] of [
      [byIp(), `login:ip:${ip}`],
      [byEmail(), `login:email:${email}`],
    ] as const) {
      if ((await store.remaining(key)) <= 0) {
        throw new AppException('E_RATE_LIMITED', { retryAfter: await store.availableIn(key) })
      }
    }
  }

  async recordFailure(ip: string, email: string) {
    await byIp().increment(`login:ip:${ip}`)
    await byEmail().increment(`login:email:${email}`)
  }

  async recordSuccess(email: string) {
    await byEmail().delete(`login:email:${email}`)
  }
}

export default new LoginThrottle()
