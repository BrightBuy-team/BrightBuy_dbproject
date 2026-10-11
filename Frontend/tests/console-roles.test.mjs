import assert from 'node:assert/strict'
import { test } from 'node:test'
import { landingPage, portalOf, resolveSection, sectionsFor } from '../src/console/roles.ts'

const customer = { accountType: 'CUSTOMER', role: 'Customer' }
const staff = { accountType: 'EMPLOYEE', role: 'WarehouseStaff' }
const manager = { accountType: 'EMPLOYEE', role: 'Management' }
const admin = { accountType: 'EMPLOYEE', role: 'Admin' }

test('each role sees only its own console sections', () => {
  assert.deepEqual(sectionsFor('WarehouseStaff'), ['overview', 'inventory', 'products', 'categories'])
  assert.deepEqual(sectionsFor('Management'), ['overview', 'reports'])
  assert.deepEqual(sectionsFor('Admin'), ['overview', 'staff', 'inventory', 'products', 'categories'])
  assert.deepEqual(sectionsFor('Customer'), [])
  assert.deepEqual(sectionsFor('Unknown'), [])
})
test('reports are for management only and staff accounts for administrators only', () => {
  assert.ok(!sectionsFor('WarehouseStaff').includes('reports'))
  assert.ok(!sectionsFor('Admin').includes('reports'))
  assert.ok(!sectionsFor('WarehouseStaff').includes('staff'))
  assert.ok(!sectionsFor('Management').includes('staff'))
})
test('a section the role may not open falls back to its dashboard', () => {
  assert.equal(resolveSection('WarehouseStaff', 'inventory'), 'inventory')
  assert.equal(resolveSection('WarehouseStaff', 'reports'), 'overview')
  assert.equal(resolveSection('Management', 'staff'), 'overview')
  assert.equal(resolveSection('Admin', null), 'overview')
  assert.equal(resolveSection('Admin', '<script>'), 'overview')
  assert.equal(resolveSection('Customer', 'overview'), undefined)
  assert.equal(resolveSection('', 'overview'), undefined)
})
test('customers land in the shop and employees in the console', () => {
  assert.equal(landingPage(customer), '/catalogue.html')
  for (const employee of [staff, manager, admin]) assert.equal(landingPage(employee), '/console.html')
})
test('each account belongs to exactly one sign-in door', () => {
  assert.equal(portalOf(customer), 'customer')
  assert.equal(portalOf(staff), 'employee')
  assert.equal(portalOf(manager), 'employee')
  assert.equal(portalOf(admin), 'admin')
})
