
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "addresses": {
                  Row: {
                    "active": boolean,"address_text": string,"created_at": string,"id": string,"is_default": boolean,"label": string,"recipient_name": string,"recipient_phone": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"address_text": string,"created_at"?: string,"id"?: string,"is_default"?: boolean,"label": string,"recipient_name": string,"recipient_phone": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"address_text"?: string,"created_at"?: string,"id"?: string,"is_default"?: boolean,"label"?: string,"recipient_name"?: string,"recipient_phone"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "addresses_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"name_ar": string,"name_en": string | null,"slug": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"name_ar": string,"name_en"?: string | null,"slug": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"name_ar"?: string,"name_en"?: string | null,"slug"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"currency_settings": {
                  Row: {
                    "code": Database["public"]['Enums']["currency_code"],"decimal_places": number,"display_label_ar": string,"enabled": boolean,"is_base": boolean,"is_default_display": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": Database["public"]['Enums']["currency_code"],"decimal_places": number,"display_label_ar": string,"enabled"?: boolean,"is_base"?: boolean,"is_default_display"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "code"?: Database["public"]['Enums']["currency_code"],"decimal_places"?: number,"display_label_ar"?: string,"enabled"?: boolean,"is_base"?: boolean,"is_default_display"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"exchange_rates": {
                  Row: {
                    "active": boolean,"base_currency": Database["public"]['Enums']["currency_code"],"created_at": string,"effective_at": string,"id": string,"quote_currency": Database["public"]['Enums']["currency_code"],"rate": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"base_currency": Database["public"]['Enums']["currency_code"],"created_at"?: string,"effective_at"?: string,"id"?: string,"quote_currency": Database["public"]['Enums']["currency_code"],"rate": number
                  }
                  Update: {
                    "active"?: boolean,"base_currency"?: Database["public"]['Enums']["currency_code"],"created_at"?: string,"effective_at"?: string,"id"?: string,"quote_currency"?: Database["public"]['Enums']["currency_code"],"rate"?: number
                  }
                  Relationships: [
                    
                  ]
                },"financial_settings": {
                  Row: {
                    "delivery_fee_currency": Database["public"]['Enums']["currency_code"],"delivery_fee_minor": number,"id": boolean,"tax_rate_bps": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "delivery_fee_currency": Database["public"]['Enums']["currency_code"],"delivery_fee_minor"?: number,"id"?: boolean,"tax_rate_bps"?: number,"updated_at"?: string
                  }
                  Update: {
                    "delivery_fee_currency"?: Database["public"]['Enums']["currency_code"],"delivery_fee_minor"?: number,"id"?: boolean,"tax_rate_bps"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"goods_receipts": {
                  Row: {
                    "id": string,"metadata": NonNullable<Json>,"purchase_order_id": string,"received_at": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"metadata"?: NonNullable<Json>,"purchase_order_id": string,"received_at"?: string,"warehouse_id": string
                  }
                  Update: {
                    "id"?: string,"metadata"?: NonNullable<Json>,"purchase_order_id"?: string,"received_at"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "goods_receipts_purchase_order_id_fkey"
      columns: ["purchase_order_id"]
isOneToOne: false
      referencedRelation: "purchase_orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "goods_receipts_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_balances": {
                  Row: {
                    "on_hand": number,"product_id": string,"reserved": number,"updated_at": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "on_hand"?: number,"product_id": string,"reserved"?: number,"updated_at"?: string,"warehouse_id": string
                  }
                  Update: {
                    "on_hand"?: number,"product_id"?: string,"reserved"?: number,"updated_at"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_balances_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_balances_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_batches": {
                  Row: {
                    "batch_number": string | null,"created_at": string,"expires_on": string | null,"id": string,"product_id": string,"quantity": number,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_number"?: string | null,"created_at"?: string,"expires_on"?: string | null,"id"?: string,"product_id": string,"quantity"?: number,"warehouse_id": string
                  }
                  Update: {
                    "batch_number"?: string | null,"created_at"?: string,"expires_on"?: string | null,"id"?: string,"product_id"?: string,"quantity"?: number,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_batches_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_batches_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_movements": {
                  Row: {
                    "batch_id": string | null,"created_at": string,"id": string,"movement_type": Database["public"]['Enums']["inventory_movement_type"],"product_id": string,"quantity_delta": number,"reference_id": string | null,"reference_type": string | null,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_id"?: string | null,"created_at"?: string,"id"?: string,"movement_type": Database["public"]['Enums']["inventory_movement_type"],"product_id": string,"quantity_delta": number,"reference_id"?: string | null,"reference_type"?: string | null,"warehouse_id": string
                  }
                  Update: {
                    "batch_id"?: string | null,"created_at"?: string,"id"?: string,"movement_type"?: Database["public"]['Enums']["inventory_movement_type"],"product_id"?: string,"quantity_delta"?: number,"reference_id"?: string | null,"reference_type"?: string | null,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_movements_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "inventory_batches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_movements_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_movements_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"media_assets": {
                  Row: {
                    "alt_text_ar": string | null,"checksum": string | null,"created_at": string,"external_url": string | null,"height": number | null,"id": string,"metadata": NonNullable<Json>,"mime_type": string | null,"object_key": string | null,"provider": Database["public"]['Enums']["media_provider"],"updated_at": string,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alt_text_ar"?: string | null,"checksum"?: string | null,"created_at"?: string,"external_url"?: string | null,"height"?: number | null,"id"?: string,"metadata"?: NonNullable<Json>,"mime_type"?: string | null,"object_key"?: string | null,"provider": Database["public"]['Enums']["media_provider"],"updated_at"?: string,"width"?: number | null
                  }
                  Update: {
                    "alt_text_ar"?: string | null,"checksum"?: string | null,"created_at"?: string,"external_url"?: string | null,"height"?: number | null,"id"?: string,"metadata"?: NonNullable<Json>,"mime_type"?: string | null,"object_key"?: string | null,"provider"?: Database["public"]['Enums']["media_provider"],"updated_at"?: string,"width"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"order_items": {
                  Row: {
                    "base_line_total_minor": number,"base_unit_price_minor": number,"created_at": string,"currency": Database["public"]['Enums']["currency_code"],"currency_decimal_places": number,"id": string,"line_total_minor": number,"name_ar_snapshot": string,"order_id": string,"package_label_ar_snapshot": string | null,"product_id": string | null,"quantity": number,"sku_snapshot": string,"unit_label_ar_snapshot": string,"unit_price_minor": number
                  }
                  ComputedFields: never
                  Insert: {
                    "base_line_total_minor": number,"base_unit_price_minor": number,"created_at"?: string,"currency": Database["public"]['Enums']["currency_code"],"currency_decimal_places": number,"id"?: string,"line_total_minor": number,"name_ar_snapshot": string,"order_id": string,"package_label_ar_snapshot"?: string | null,"product_id"?: string | null,"quantity": number,"sku_snapshot": string,"unit_label_ar_snapshot": string,"unit_price_minor": number
                  }
                  Update: {
                    "base_line_total_minor"?: number,"base_unit_price_minor"?: number,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency_code"],"currency_decimal_places"?: number,"id"?: string,"line_total_minor"?: number,"name_ar_snapshot"?: string,"order_id"?: string,"package_label_ar_snapshot"?: string | null,"product_id"?: string | null,"quantity"?: number,"sku_snapshot"?: string,"unit_label_ar_snapshot"?: string,"unit_price_minor"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"order_status_history": {
                  Row: {
                    "created_at": string,"doctor_message_ar": string | null,"id": string,"order_id": string,"status": Database["public"]['Enums']["order_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"doctor_message_ar"?: string | null,"id"?: string,"order_id": string,"status": Database["public"]['Enums']["order_status"]
                  }
                  Update: {
                    "created_at"?: string,"doctor_message_ar"?: string | null,"id"?: string,"order_id"?: string,"status"?: Database["public"]['Enums']["order_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_status_history_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "base_currency": Database["public"]['Enums']["currency_code"],"base_delivery_fee_minor": number,"base_subtotal_minor": number,"base_tax_minor": number,"base_total_minor": number,"created_at": string,"currency": Database["public"]['Enums']["currency_code"],"currency_decimal_places": number,"delivery_address_snapshot": string,"delivery_fee_minor": number,"delivery_notes": string | null,"exchange_rate_snapshot": number,"id": string,"idempotency_key": string,"order_number": string,"payment_method": string,"recipient_name_snapshot": string,"recipient_phone_snapshot": string,"status": Database["public"]['Enums']["order_status"],"subtotal_minor": number,"tax_minor": number,"total_minor": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base_currency": Database["public"]['Enums']["currency_code"],"base_delivery_fee_minor": number,"base_subtotal_minor": number,"base_tax_minor": number,"base_total_minor": number,"created_at"?: string,"currency": Database["public"]['Enums']["currency_code"],"currency_decimal_places": number,"delivery_address_snapshot": string,"delivery_fee_minor": number,"delivery_notes"?: string | null,"exchange_rate_snapshot": number,"id"?: string,"idempotency_key": string,"order_number": string,"payment_method"?: string,"recipient_name_snapshot": string,"recipient_phone_snapshot": string,"status"?: Database["public"]['Enums']["order_status"],"subtotal_minor": number,"tax_minor": number,"total_minor": number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "base_currency"?: Database["public"]['Enums']["currency_code"],"base_delivery_fee_minor"?: number,"base_subtotal_minor"?: number,"base_tax_minor"?: number,"base_total_minor"?: number,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency_code"],"currency_decimal_places"?: number,"delivery_address_snapshot"?: string,"delivery_fee_minor"?: number,"delivery_notes"?: string | null,"exchange_rate_snapshot"?: number,"id"?: string,"idempotency_key"?: string,"order_number"?: string,"payment_method"?: string,"recipient_name_snapshot"?: string,"recipient_phone_snapshot"?: string,"status"?: Database["public"]['Enums']["order_status"],"subtotal_minor"?: number,"tax_minor"?: number,"total_minor"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"product_media": {
                  Row: {
                    "is_primary": boolean,"media_asset_id": string,"product_id": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "is_primary"?: boolean,"media_asset_id": string,"product_id": string,"sort_order"?: number
                  }
                  Update: {
                    "is_primary"?: boolean,"media_asset_id"?: string,"product_id"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_media_media_asset_id_fkey"
      columns: ["media_asset_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_media_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"product_prices": {
                  Row: {
                    "active": boolean,"amount_minor": number,"created_at": string,"currency": Database["public"]['Enums']["currency_code"],"decimal_places": number,"id": string,"product_id": string,"valid_from": string,"valid_to": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"amount_minor": number,"created_at"?: string,"currency": Database["public"]['Enums']["currency_code"],"decimal_places": number,"id"?: string,"product_id": string,"valid_from"?: string,"valid_to"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"amount_minor"?: number,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency_code"],"decimal_places"?: number,"id"?: string,"product_id"?: string,"valid_from"?: string,"valid_to"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_prices_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"product_sourcing_suggestions": {
                  Row: {
                    "catalog_priority": string,"created_at": string,"product_id": string,"source_note": string | null,"suggested_brands": (string)[],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "catalog_priority": string,"created_at"?: string,"product_id": string,"source_note"?: string | null,"suggested_brands"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "catalog_priority"?: string,"created_at"?: string,"product_id"?: string,"source_note"?: string | null,"suggested_brands"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_sourcing_suggestions_product_id_fkey"
      columns: ["product_id"]
isOneToOne: true
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "active": boolean,"availability": Database["public"]['Enums']["product_availability"],"category_id": string,"created_at": string,"description_ar": string | null,"id": string,"manufacturer": string | null,"name_ar": string,"name_en": string | null,"package_label_ar": string | null,"search_text": string | null,"sku": string,"specifications_ar": string | null,"unit_label_ar": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"availability"?: Database["public"]['Enums']["product_availability"],"category_id": string,"created_at"?: string,"description_ar"?: string | null,"id"?: string,"manufacturer"?: string | null,"name_ar": string,"name_en"?: string | null,"package_label_ar"?: string | null,"search_text"?: never,"sku": string,"specifications_ar"?: string | null,"unit_label_ar": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"availability"?: Database["public"]['Enums']["product_availability"],"category_id"?: string,"created_at"?: string,"description_ar"?: string | null,"id"?: string,"manufacturer"?: string | null,"name_ar"?: string,"name_en"?: string | null,"package_label_ar"?: string | null,"search_text"?: never,"sku"?: string,"specifications_ar"?: string | null,"unit_label_ar"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "clinic_name": string | null,"created_at": string,"default_address": string | null,"email": string | null,"full_name": string,"id": string,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clinic_name"?: string | null,"created_at"?: string,"default_address"?: string | null,"email"?: string | null,"full_name": string,"id": string,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "clinic_name"?: string | null,"created_at"?: string,"default_address"?: string | null,"email"?: string | null,"full_name"?: string,"id"?: string,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"purchase_order_items": {
                  Row: {
                    "created_at": string,"id": string,"product_id": string,"purchase_order_id": string,"quantity": number,"unit_cost_minor": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"product_id": string,"purchase_order_id": string,"quantity": number,"unit_cost_minor": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"product_id"?: string,"purchase_order_id"?: string,"quantity"?: number,"unit_cost_minor"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
      columns: ["purchase_order_id"]
isOneToOne: false
      referencedRelation: "purchase_orders"
      referencedColumns: ["id"]
    }
                  ]
                },"purchase_orders": {
                  Row: {
                    "created_at": string,"currency": Database["public"]['Enums']["currency_code"],"id": string,"ordered_at": string | null,"status": Database["public"]['Enums']["purchase_order_status"],"updated_at": string,"vendor_id": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"currency": Database["public"]['Enums']["currency_code"],"id"?: string,"ordered_at"?: string | null,"status"?: Database["public"]['Enums']["purchase_order_status"],"updated_at"?: string,"vendor_id": string,"warehouse_id": string
                  }
                  Update: {
                    "created_at"?: string,"currency"?: Database["public"]['Enums']["currency_code"],"id"?: string,"ordered_at"?: string | null,"status"?: Database["public"]['Enums']["purchase_order_status"],"updated_at"?: string,"vendor_id"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_orders_vendor_id_fkey"
      columns: ["vendor_id"]
isOneToOne: false
      referencedRelation: "vendors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_orders_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"support_cases": {
                  Row: {
                    "created_at": string,"id": string,"message": string,"status": string,"subject": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"message": string,"status"?: string,"subject": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"message"?: string,"status"?: string,"subject"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_cases_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"vendors": {
                  Row: {
                    "active": boolean,"code": string,"created_at": string,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"code": string,"created_at"?: string,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"created_at"?: string,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"warehouses": {
                  Row: {
                    "active": boolean,"code": string,"created_at": string,"id": string,"name_ar": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"code": string,"created_at"?: string,"id"?: string,"name_ar": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"created_at"?: string,"id"?: string,"name_ar"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "create_doctor_order":
{ Args: { "p_delivery_address": string,"p_delivery_notes": string,"p_display_currency": Database["public"]['Enums']["currency_code"],"p_idempotency_key": string,"p_items": Json,"p_recipient_name": string,"p_recipient_phone": string }; Returns: {
              "order_id": string,"order_number": string
            }[]
                           }
          }
          Enums: {
            "currency_code": "USD"|"NEW_SYP","inventory_movement_type": "receipt"|"allocation"|"release"|"adjustment"|"dispatch"|"return","media_provider": "supabase"|"external"|"cdn","order_status": "received"|"sourcing"|"preparing"|"ready_for_delivery"|"out_for_delivery"|"delivered"|"cancelled"|"problem","product_availability": "available"|"limited"|"unavailable","purchase_order_status": "draft"|"submitted"|"partially_received"|"received"|"cancelled"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "currency_code": ["USD", "NEW_SYP"],"inventory_movement_type": ["receipt", "allocation", "release", "adjustment", "dispatch", "return"],"media_provider": ["supabase", "external", "cdn"],"order_status": ["received", "sourcing", "preparing", "ready_for_delivery", "out_for_delivery", "delivered", "cancelled", "problem"],"product_availability": ["available", "limited", "unavailable"],"purchase_order_status": ["draft", "submitted", "partially_received", "received", "cancelled"]
          }
        }
} as const
