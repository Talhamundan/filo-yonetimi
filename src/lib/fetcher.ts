export const fetcher = async <T = unknown>(url: string): Promise<T> => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`)
  }
  return res.json() as Promise<T>
}

