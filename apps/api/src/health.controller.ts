import { Controller, Get } from '@nestjs/common'

// Served at /api/health. Not /healthz: Cloud Run's front end reserves some paths ending in "z" and answers them with its own 404.
@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', uptime: process.uptime() }
  }
}
