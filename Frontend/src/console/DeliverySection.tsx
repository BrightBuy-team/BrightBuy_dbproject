import { useCallback, useEffect, useState } from 'react'
import { MapPin, PackageCheck, Truck } from 'lucide-react'
import { ApiError, apiBase, apiRequest } from '../catalogue/client'
import { Feedback, PageHeader } from './parts'

type Delivery = {
  deliveryId: number
  orderId: number
  addressLine: string | null
  cityName: string | null
  estimatedDate: string | null
  assignedEmployeeId: number | null
}
type Driver = { employeeId: number; name: string }

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message
    : error instanceof Error ? error.message : 'Could not complete the delivery request.'
}

export default function DeliverySection({ role }: { role: string }) {
  const driver = role === 'DeliveryDriver'
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [selectedDrivers, setSelectedDrivers] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const queueUrl = apiBase('delivery') + (driver ? '/staff/assigned' : '/staff/queue')
    return Promise.all([
      apiRequest<Delivery[]>(queueUrl),
      driver ? Promise.resolve([] as Driver[]) : apiRequest<Driver[]>(apiBase('delivery') + '/staff/drivers'),
    ])
  }, [driver])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const results = await load()
      setDeliveries(results[0])
      setDrivers(results[1])
      setSelectedDrivers({})
    } catch (failure) {
      setDeliveries([])
      setDrivers([])
      setError(errorMessage(failure))
    } finally {
      setLoading(false)
    }
  }, [load])

  useEffect(() => {
    let active = true
    load().then(results => {
      if (active) {
        setDeliveries(results[0])
        setDrivers(results[1])
      }
    }).catch(failure => {
      if (active) {
        setDeliveries([])
        setDrivers([])
        setError(errorMessage(failure))
      }
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [load])

  async function assign(delivery: Delivery) {
    const value = selectedDrivers[delivery.deliveryId] ?? String(delivery.assignedEmployeeId ?? '')
    setBusyId(delivery.deliveryId); setError(''); setNotice('')
    try {
      await apiRequest<void>(`${apiBase('delivery')}/staff/${delivery.deliveryId}/assignment`, {
        method: 'PUT',
        body: JSON.stringify({ employeeId: value === '' ? null : Number(value) }),
      })
      setNotice(value === '' ? `Order #${delivery.orderId} is now unassigned.`
        : `Order #${delivery.orderId} was assigned to ${drivers.find(item => item.employeeId === Number(value))?.name ?? 'the selected driver'}.`)
      await refresh()
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusyId(null)
    }
  }

  async function markDelivered(delivery: Delivery) {
    setBusyId(delivery.deliveryId); setError(''); setNotice('')
    try {
      await apiRequest<void>(`${apiBase('delivery')}/staff/${delivery.deliveryId}/delivered`, { method: 'POST' })
      setNotice(`Order #${delivery.orderId} marked delivered.`)
      await refresh()
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusyId(null)
    }
  }

  return <div className="console-page">
    <PageHeader eyebrow={driver ? 'Delivery route' : 'Fulfilment'} title={driver ? 'My deliveries' : 'Deliveries'}
      text={driver ? 'Only deliveries assigned to you appear here. Mark each one delivered when it reaches the customer.'
        : 'Assign or reassign pending deliveries to an active delivery driver. Drivers can only complete their own assigned deliveries.'}
      actions={<button type="button" className="bb-btn" onClick={() => void refresh()} disabled={loading}>Refresh</button>} />
    <Feedback notice={notice} error={error} />
    {loading ? <div className="bb-card bb-card-pad" role="status">Loading pending deliveries…</div>
      : deliveries.length === 0 ? <div className="bb-card bb-card-pad delivery-empty">
        <PackageCheck aria-hidden="true" /><strong>No pending deliveries</strong>
        <span>{driver ? 'New deliveries assigned to you will appear here.' : 'There are no deliveries waiting for assignment or delivery.'}</span>
      </div>
        : <div className="delivery-list">{deliveries.map(delivery => {
          const currentDriver = drivers.find(item => item.employeeId === delivery.assignedEmployeeId)
          const selectedDriver = selectedDrivers[delivery.deliveryId] ?? String(delivery.assignedEmployeeId ?? '')
          return <article className="bb-card delivery-card" key={delivery.deliveryId}>
            <div className="delivery-details">
              <div className="delivery-order"><Truck aria-hidden="true" /><strong>Order #{delivery.orderId}</strong>
                {delivery.estimatedDate && <span className="bb-chip plain">Est. {delivery.estimatedDate}</span>}</div>
              <p><MapPin aria-hidden="true" />{delivery.addressLine || 'Address not recorded'}{delivery.cityName ? `, ${delivery.cityName}` : ''}</p>
              {!driver && <small>{currentDriver ? `Assigned to ${currentDriver.name}` : 'Not assigned'}</small>}
            </div>
            {driver
              ? <button type="button" className="bb-btn bb-btn-primary" disabled={busyId === delivery.deliveryId}
                  onClick={() => void markDelivered(delivery)}>
                  {busyId === delivery.deliveryId ? 'Saving…' : 'Mark delivered'}
                </button>
              : <div className="delivery-assign">
                <label className="bb-field">Delivery driver
                  <select value={selectedDriver} disabled={busyId === delivery.deliveryId}
                    onChange={event => setSelectedDrivers(current => ({ ...current, [delivery.deliveryId]: event.target.value }))}>
                    <option value="">Unassigned</option>
                    {delivery.assignedEmployeeId !== null && !currentDriver
                      && <option value={delivery.assignedEmployeeId}>Inactive driver #{delivery.assignedEmployeeId} (reassign)</option>}
                    {drivers.map(item => <option key={item.employeeId} value={item.employeeId}>{item.name}</option>)}
                  </select>
                </label>
                <button type="button" className="bb-btn bb-btn-primary" disabled={busyId === delivery.deliveryId || selectedDriver === String(delivery.assignedEmployeeId ?? '')}
                  onClick={() => void assign(delivery)}>
                  {busyId === delivery.deliveryId ? 'Saving…' : 'Save assignment'}
                </button>
              </div>}
          </article>
        })}</div>}
  </div>
}
