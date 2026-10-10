export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      cargo_permissoes: {
        Row: {
          cargo_id: string
          nivel: Database["public"]["Enums"]["nivel_acesso"]
          setor: string
        }
        Insert: {
          cargo_id: string
          nivel: Database["public"]["Enums"]["nivel_acesso"]
          setor: string
        }
        Update: {
          cargo_id?: string
          nivel?: Database["public"]["Enums"]["nivel_acesso"]
          setor?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargo_permissoes_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_permissoes_setor_fkey"
            columns: ["setor"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["codigo"]
          },
        ]
      }
      cargos: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      categoria_atributos: {
        Row: {
          atributo: string
          categoria_id: string
          id: string
          obrigatorio: boolean
          rotulo: string
        }
        Insert: {
          atributo: string
          categoria_id: string
          id?: string
          obrigatorio?: boolean
          rotulo: string
        }
        Update: {
          atributo?: string
          categoria_id?: string
          id?: string
          obrigatorio?: boolean
          rotulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "categoria_atributos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          codigo: string
          id: string
          nome: string
          ordem: number
          unidade_medida: string
        }
        Insert: {
          codigo: string
          id?: string
          nome: string
          ordem?: number
          unidade_medida?: string
        }
        Update: {
          codigo?: string
          id?: string
          nome?: string
          ordem?: number
          unidade_medida?: string
        }
        Relationships: []
      }
      movimentacoes_estoque: {
        Row: {
          created_at: string
          id: string
          observacao: string | null
          origem_id: string | null
          origem_tipo: string | null
          produto_id: string
          quantidade: number
          saldo_anterior: number
          saldo_posterior: number
          tipo: Database["public"]["Enums"]["tipo_movimentacao"]
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          observacao?: string | null
          origem_id?: string | null
          origem_tipo?: string | null
          produto_id: string
          quantidade: number
          saldo_anterior: number
          saldo_posterior: number
          tipo: Database["public"]["Enums"]["tipo_movimentacao"]
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          observacao?: string | null
          origem_id?: string | null
          origem_tipo?: string | null
          produto_id?: string
          quantidade?: number
          saldo_anterior?: number
          saldo_posterior?: number
          tipo?: Database["public"]["Enums"]["tipo_movimentacao"]
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_historico: {
        Row: {
          campo: string
          created_at: string
          id: string
          pedido_id: string
          usuario_id: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          campo: string
          created_at?: string
          id?: string
          pedido_id: string
          usuario_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          campo?: string
          created_at?: string
          id?: string
          pedido_id?: string
          usuario_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_historico_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_itens: {
        Row: {
          altura: number | null
          categoria_codigo: string
          consumo: number
          id: string
          largura: number | null
          pedido_id: string
          preco_unitario: number
          produto_id: string
          produto_nome: string
          quantidade: number
          unidade: string
        }
        Insert: {
          altura?: number | null
          categoria_codigo: string
          consumo: number
          id?: string
          largura?: number | null
          pedido_id: string
          preco_unitario: number
          produto_id: string
          produto_nome: string
          quantidade: number
          unidade: string
        }
        Update: {
          altura?: number | null
          categoria_codigo?: string
          consumo?: number
          id?: string
          largura?: number | null
          pedido_id?: string
          preco_unitario?: number
          produto_id?: string
          produto_nome?: string
          quantidade?: number
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          chave_idempotencia: string | null
          cliente_nome: string
          created_at: string
          descricao: string | null
          endereco: string | null
          id: string
          metodo_pagamento:
            | Database["public"]["Enums"]["metodo_pagamento"]
            | null
          numero: number
          preco_limite: number | null
          preco_real: number | null
          preco_venda: number | null
          status: Database["public"]["Enums"]["status_pedido"]
          updated_at: string
          valor_cancelamento: number | null
          vendedor_id: string | null
        }
        Insert: {
          chave_idempotencia?: string | null
          cliente_nome: string
          created_at?: string
          descricao?: string | null
          endereco?: string | null
          id?: string
          metodo_pagamento?:
            | Database["public"]["Enums"]["metodo_pagamento"]
            | null
          numero?: never
          preco_limite?: number | null
          preco_real?: number | null
          preco_venda?: number | null
          status?: Database["public"]["Enums"]["status_pedido"]
          updated_at?: string
          valor_cancelamento?: number | null
          vendedor_id?: string | null
        }
        Update: {
          chave_idempotencia?: string | null
          cliente_nome?: string
          created_at?: string
          descricao?: string | null
          endereco?: string | null
          id?: string
          metodo_pagamento?:
            | Database["public"]["Enums"]["metodo_pagamento"]
            | null
          numero?: never
          preco_limite?: number | null
          preco_real?: number | null
          preco_venda?: number | null
          status?: Database["public"]["Enums"]["status_pedido"]
          updated_at?: string
          valor_cancelamento?: number | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_atributos: {
        Row: {
          atributo: string
          produto_id: string
          valor: string
        }
        Insert: {
          atributo: string
          produto_id: string
          valor: string
        }
        Update: {
          atributo?: string
          produto_id?: string
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_atributos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          categoria_id: string
          cor: string
          created_at: string
          created_by: string | null
          descricao: string | null
          estoque_max: number | null
          estoque_min: number | null
          id: string
          nome: string
          preco: number
          quantidade: number
          status: Database["public"]["Enums"]["status_produto"]
          tipo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          categoria_id: string
          cor: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          estoque_max?: number | null
          estoque_min?: number | null
          id?: string
          nome: string
          preco?: number
          quantidade?: number
          status?: Database["public"]["Enums"]["status_produto"]
          tipo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          categoria_id?: string
          cor?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          estoque_max?: number | null
          estoque_min?: number | null
          id?: string
          nome?: string
          preco?: number
          quantidade?: number
          status?: Database["public"]["Enums"]["status_produto"]
          tipo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cargo_id: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          tipo_conta: Database["public"]["Enums"]["tipo_conta"]
        }
        Insert: {
          cargo_id?: string | null
          created_at?: string
          email?: string | null
          id: string
          nome?: string
          tipo_conta?: Database["public"]["Enums"]["tipo_conta"]
        }
        Update: {
          cargo_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          tipo_conta?: Database["public"]["Enums"]["tipo_conta"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
        ]
      }
      setores: {
        Row: {
          codigo: string
          nome: string
        }
        Insert: {
          codigo: string
          nome: string
        }
        Update: {
          codigo?: string
          nome?: string
        }
        Relationships: []
      }
      usuario_permissoes: {
        Row: {
          nivel: Database["public"]["Enums"]["nivel_acesso"]
          setor: string
          user_id: string
        }
        Insert: {
          nivel: Database["public"]["Enums"]["nivel_acesso"]
          setor: string
          user_id: string
        }
        Update: {
          nivel?: Database["public"]["Enums"]["nivel_acesso"]
          setor?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_permissoes_setor_fkey"
            columns: ["setor"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "usuario_permissoes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _exigir_login: { Args: never; Returns: undefined }
      _gravar_itens: {
        Args: { _checar_disponivel: boolean; _itens: Json; _pedido: string }
        Returns: string
      }
      _hist: {
        Args: { _ant: string; _campo: string; _novo: string; _pedido: string }
        Returns: undefined
      }
      _mov_estoque_pedido: {
        Args: {
          _obs: string
          _pedido: string
          _produto: string
          _quantidade: number
          _tipo: Database["public"]["Enums"]["tipo_movimentacao"]
        }
        Returns: number
      }
      _sincronizar_estoque: {
        Args: { _motivo: string; _pedido: string; _zerar: boolean }
        Returns: undefined
      }
      _status_baixa: {
        Args: { _s: Database["public"]["Enums"]["status_pedido"] }
        Returns: boolean
      }
      _status_usa_venda: {
        Args: { _s: Database["public"]["Enums"]["status_pedido"] }
        Returns: boolean
      }
      alterar_status_pedido: {
        Args: {
          _devolver?: boolean
          _id: string
          _status: Database["public"]["Enums"]["status_pedido"]
        }
        Returns: undefined
      }
      alterar_status_produto: {
        Args: {
          _id: string
          _status: Database["public"]["Enums"]["status_produto"]
        }
        Returns: undefined
      }
      atualizar_itens_pedido: {
        Args: { _id: string; _itens: Json }
        Returns: undefined
      }
      atualizar_pedido: {
        Args: { _dados: Json; _id: string }
        Returns: undefined
      }
      atualizar_produto: {
        Args: { _atributos: Json; _dados: Json; _id: string }
        Returns: undefined
      }
      criar_pedido: {
        Args: { _chave: string; _dados: Json; _itens: Json }
        Returns: string
      }
      criar_produto: {
        Args: { _atributos: Json; _dados: Json; _quantidade_inicial?: number }
        Returns: string
      }
      exigir_edicao_estoque: { Args: never; Returns: undefined }
      materiais_disponiveis: {
        Args: never
        Returns: {
          categoria_codigo: string
          categoria_nome: string
          cor: string
          detalhe: string
          id: string
          nome: string
          preco: number
          quantidade: number
          tipo: string
          unidade: string
        }[]
      }
      movimentar_estoque: {
        Args: {
          _observacao?: string
          _produto: string
          _quantidade: number
          _tipo: Database["public"]["Enums"]["tipo_movimentacao"]
        }
        Returns: {
          created_at: string
          id: string
          observacao: string | null
          origem_id: string | null
          origem_tipo: string | null
          produto_id: string
          quantidade: number
          saldo_anterior: number
          saldo_posterior: number
          tipo: Database["public"]["Enums"]["tipo_movimentacao"]
          usuario_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "movimentacoes_estoque"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      nivel_acesso_setor: {
        Args: { _setor: string; _user: string }
        Returns: Database["public"]["Enums"]["nivel_acesso"]
      }
      pedido_baixado: {
        Args: { _pedido: string }
        Returns: {
          produto_id: string
          quantidade: number
        }[]
      }
      pedido_tem_baixa: { Args: { _id: string }; Returns: boolean }
      salvar_atributos: {
        Args: { _atributos: Json; _categoria: string; _produto: string }
        Returns: undefined
      }
    }
    Enums: {
      metodo_pagamento:
        | "pix"
        | "debito"
        | "credito"
        | "boleto"
        | "dinheiro"
        | "cheque"
      nivel_acesso: "sem_acesso" | "visualizacao" | "edicao"
      status_pedido:
        | "orcamento"
        | "aprovado"
        | "preparacao"
        | "finalizado"
        | "enviado"
        | "concluido"
        | "cancelado"
      status_produto: "ativo" | "inativo"
      tipo_conta: "empresarial" | "profissional"
      tipo_movimentacao:
        | "entrada"
        | "saida"
        | "ajuste_positivo"
        | "ajuste_negativo"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      metodo_pagamento: [
        "pix",
        "debito",
        "credito",
        "boleto",
        "dinheiro",
        "cheque",
      ],
      nivel_acesso: ["sem_acesso", "visualizacao", "edicao"],
      status_pedido: [
        "orcamento",
        "aprovado",
        "preparacao",
        "finalizado",
        "enviado",
        "concluido",
        "cancelado",
      ],
      status_produto: ["ativo", "inativo"],
      tipo_conta: ["empresarial", "profissional"],
      tipo_movimentacao: [
        "entrada",
        "saida",
        "ajuste_positivo",
        "ajuste_negativo",
      ],
    },
  },
} as const
