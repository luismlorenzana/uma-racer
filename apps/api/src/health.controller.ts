import { Controller, Get } from '@nestjs/common'
import { Public } from '@luismlorenzana/uma-server/auth'

// Served at /api/health, the one route without the guard. Not /healthz: Cloud Run's front end reserves some paths ending in "z" and answers them with its own 404.
@Public()
@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', uptime: process.uptime() }
  }
}
