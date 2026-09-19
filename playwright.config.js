import { defineConfig } from '@playwright/test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const root=mkdtempSync(join(process.cwd(),'storage/framework/laravel-hub-ui-'))
const storage=join(root,'storage')
for(const path of ['app/private','framework/cache/data','framework/sessions','framework/views','logs'])mkdirSync(join(storage,path),{recursive:true})
const database=join(root,'test.sqlite');writeFileSync(database,'')
export default defineConfig({testDir:'tests/Browser',testMatch:'*.spec.js',timeout:90000,expect:{timeout:15000},workers:1,retries:0,use:{baseURL:'http://127.0.0.1:4321',viewport:{width:1440,height:1000},actionTimeout:10000,screenshot:'on',trace:'retain-on-failure'},webServer:{command:'php artisan migrate --force --no-interaction && php artisan hub:start --port=4321',url:'http://127.0.0.1:4321',env:{DB_DATABASE:database,LARAVEL_STORAGE_PATH:storage,APP_URL:'http://127.0.0.1:4321'},reuseExistingServer:false}})
