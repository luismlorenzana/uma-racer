/** "1 ticket", "6 tickets": prices read from the domain, so a run's price can be one (D148). */
export const formatTickets = (count: number): string => `${count} ticket${count === 1 ? '' : 's'}`
