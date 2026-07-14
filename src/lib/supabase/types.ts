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
          nombre: string | null;
          tipo_diabetes: string | null;
          anio_nacimiento: number | null;
          sexo: string | null;
          peso_kg: number | null;
          altura_cm: number | null;
          menstrua: boolean | null;
          onboarding_completo: boolean;
          creado_en: string;
        };
        Insert: {
          id: string;
          nombre?: string | null;
          tipo_diabetes?: string | null;
          anio_nacimiento?: number | null;
          sexo?: string | null;
          peso_kg?: number | null;
          altura_cm?: number | null;
          menstrua?: boolean | null;
          onboarding_completo?: boolean;
          creado_en?: string;
        };
        Update: {
          nombre?: string | null;
          tipo_diabetes?: string | null;
          anio_nacimiento?: number | null;
          sexo?: string | null;
          peso_kg?: number | null;
          altura_cm?: number | null;
          menstrua?: boolean | null;
          onboarding_completo?: boolean;
        };
        Relationships: [];
      };
      insulina_usuario: {
        Row: {
          id: string;
          usuario_id: string;
          clase: string;
          marca: string | null;
          activa: boolean;
          creado_en: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          clase: string;
          marca?: string | null;
          activa?: boolean;
          creado_en?: string;
        };
        Update: {
          clase?: string;
          marca?: string | null;
          activa?: boolean;
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
      patron: {
        Row: {
          id: string;
          usuario_id: string;
          factor: string;
          efecto_estimado: number | null;
          n_observaciones: number;
          confianza: number;
          detalle: Json | null;
          actualizado_en: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          factor: string;
          efecto_estimado?: number | null;
          n_observaciones: number;
          confianza: number;
          detalle?: Json | null;
          actualizado_en?: string;
        };
        Update: {
          factor?: string;
          efecto_estimado?: number | null;
          n_observaciones?: number;
          confianza?: number;
          detalle?: Json | null;
          actualizado_en?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
