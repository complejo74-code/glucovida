export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      usuario: {
        Row: {
          id: string;
          tipo_diabetes: string | null;
          creado_en: string;
        };
        Insert: {
          id: string;
          tipo_diabetes?: string | null;
          creado_en?: string;
        };
        Update: {
          tipo_diabetes?: string | null;
        };
        Relationships: [];
      };
      evento: {
        Row: {
          id: string;
          usuario_id: string;
          tipo: string;
          valor_num: number | null;
          valor_texto: string | null;
          metadatos: Json | null;
          ocurrido_en: string;
          creado_en: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          tipo: string;
          valor_num?: number | null;
          valor_texto?: string | null;
          metadatos?: Json | null;
          ocurrido_en?: string;
          creado_en?: string;
        };
        Update: {
          tipo?: string;
          valor_num?: number | null;
          valor_texto?: string | null;
          metadatos?: Json | null;
          ocurrido_en?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
