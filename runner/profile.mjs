import { createHash } from 'node:crypto'
export const devices = { desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } }
export const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex')
