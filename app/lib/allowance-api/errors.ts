export class AllowanceError extends Error {
  readonly code: string
  readonly status: number
  readonly field?: string

  constructor(code: string, status: number, field?: string) {
    super(code)
    this.name = 'AllowanceError'
    this.code = code
    this.status = status
    this.field = field
  }
}
