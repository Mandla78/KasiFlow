/** A saved place the trader has stock delivered to (besides the business address). */
export type DeliveryAddress = {
  id: string;
  label: string;
  addressText: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
};

export type NewDeliveryAddress = Omit<DeliveryAddress, 'id' | 'isDefault'> & { isDefault?: boolean };

/** At most this many saved places (the server says the same). */
export const MAX_ADDRESSES = 5;

export interface DeliveryAddressesApi {
  list(): Promise<DeliveryAddress[]>;
  add(a: NewDeliveryAddress, idempotencyKey?: string): Promise<DeliveryAddress>;
  update(id: string, change: Partial<Pick<DeliveryAddress, 'label' | 'addressText' | 'latitude' | 'longitude'>>): Promise<DeliveryAddress>;
  remove(id: string): Promise<void>;
  makeDefault(id: string): Promise<DeliveryAddress>;
}
