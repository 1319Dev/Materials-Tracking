export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      check_ins: {
        Row: {
          created_at: string;
          heat_number: string;
          id: string;
          material_id: string | null;
          notes: string | null;
          product_code: string | null;
          product_name: string;
          quantity: number;
          received_at: string;
          serial_number: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          heat_number: string;
          id?: string;
          material_id?: string | null;
          notes?: string | null;
          product_code?: string | null;
          product_name: string;
          quantity?: number;
          received_at?: string;
          serial_number?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          heat_number?: string;
          id?: string;
          material_id?: string | null;
          notes?: string | null;
          product_code?: string | null;
          product_name?: string;
          quantity?: number;
          received_at?: string;
          serial_number?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          check_in_id: string;
          created_at: string;
          doc_type: Database["public"]["Enums"]["doc_type"];
          file_name: string;
          id: string;
          mime_type: string | null;
          storage_path: string;
          user_id: string;
        };
        Insert: {
          check_in_id: string;
          created_at?: string;
          doc_type: Database["public"]["Enums"]["doc_type"];
          file_name: string;
          id?: string;
          mime_type?: string | null;
          storage_path: string;
          user_id: string;
        };
        Update: {
          check_in_id?: string;
          created_at?: string;
          doc_type?: Database["public"]["Enums"]["doc_type"];
          file_name?: string;
          id?: string;
          mime_type?: string | null;
          storage_path?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      import_batches: {
        Row: {
          created_at: string;
          file_name: string | null;
          id: string;
          row_count: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          file_name?: string | null;
          id?: string;
          row_count?: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          file_name?: string | null;
          id?: string;
          row_count?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      materials: {
        Row: {
          created_at: string;
          description: string | null;
          heat_number_required: boolean;
          id: string;
          import_batch_id: string | null;
          manufacturer: string | null;
          material_grade: string | null;
          product_code: string | null;
          product_name: string;
          requires_serial: boolean;
          size: string | null;
          source_row: Json | null;
          unit: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          heat_number_required?: boolean;
          id?: string;
          import_batch_id?: string | null;
          manufacturer?: string | null;
          material_grade?: string | null;
          product_code?: string | null;
          product_name: string;
          requires_serial?: boolean;
          size?: string | null;
          source_row?: Json | null;
          unit?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          heat_number_required?: boolean;
          id?: string;
          import_batch_id?: string | null;
          manufacturer?: string | null;
          material_grade?: string | null;
          product_code?: string | null;
          product_name?: string;
          requires_serial?: boolean;
          size?: string | null;
          source_row?: Json | null;
          unit?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      doc_type: "packing_list" | "mtr" | "other";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Material = Database["public"]["Tables"]["materials"]["Row"];
export type CheckIn = Database["public"]["Tables"]["check_ins"]["Row"];
export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
export type DocType = Database["public"]["Enums"]["doc_type"];
