BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Usuario] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nome] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [login] NVARCHAR(1000) NOT NULL,
    [cpf] NVARCHAR(1000) NOT NULL,
    [senha] NVARCHAR(1000) NOT NULL,
    [perfil] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [Usuario_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Usuario_email_key] UNIQUE NONCLUSTERED ([email]),
    CONSTRAINT [Usuario_login_key] UNIQUE NONCLUSTERED ([login]),
    CONSTRAINT [Usuario_cpf_key] UNIQUE NONCLUSTERED ([cpf])
);

-- CreateTable
CREATE TABLE [dbo].[Portaria] (
    [id] INT NOT NULL IDENTITY(1,1),
    [descricao] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [Portaria_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Pessoa] (
    [matricula] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    [credenciais] NVARCHAR(1000),
    [situacao] INT NOT NULL,
    [observacao] NVARCHAR(1000),
    [data_ultima_sincronizacao] DATETIME2 NOT NULL CONSTRAINT [Pessoa_data_ultima_sincronizacao_df] DEFAULT CURRENT_TIMESTAMP,
    [ativo] BIT NOT NULL CONSTRAINT [Pessoa_ativo_df] DEFAULT 1,
    CONSTRAINT [Pessoa_pkey] PRIMARY KEY CLUSTERED ([matricula])
);

-- CreateTable
CREATE TABLE [dbo].[LeituraRFID] (
    [id] NVARCHAR(1000) NOT NULL,
    [credencial] NVARCHAR(1000) NOT NULL,
    [id_portaria] INT NOT NULL,
    [data_hora_leitura] DATETIME2 NOT NULL,
    [data_hora_sincronizacao] DATETIME2 NOT NULL CONSTRAINT [LeituraRFID_data_hora_sincronizacao_df] DEFAULT CURRENT_TIMESTAMP,
    [id_celular] NVARCHAR(1000) NOT NULL,
    [situacao] INT NOT NULL,
    CONSTRAINT [LeituraRFID_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[LogOperacao] (
    [id] INT NOT NULL IDENTITY(1,1),
    [id_usuario] INT,
    [acao] NVARCHAR(1000) NOT NULL,
    [entidade] NVARCHAR(1000) NOT NULL,
    [detalhes] TEXT NOT NULL,
    [data_hora] DATETIME2 NOT NULL CONSTRAINT [LogOperacao_data_hora_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [LogOperacao_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Veiculo] (
    [id] INT NOT NULL IDENTITY(1,1),
    [placa] NVARCHAR(1000) NOT NULL,
    [descricao] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [Veiculo_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Veiculo_placa_key] UNIQUE NONCLUSTERED ([placa])
);

-- CreateTable
CREATE TABLE [dbo].[LeituraVeiculo] (
    [id] NVARCHAR(1000) NOT NULL,
    [placa] NVARCHAR(1000) NOT NULL,
    [matricula_condutor] NVARCHAR(1000) NOT NULL,
    [nome_condutor] NVARCHAR(1000) NOT NULL,
    [credencial_condutor] NVARCHAR(1000),
    [data_hora_leitura] DATETIME2 NOT NULL,
    [id_celular] NVARCHAR(1000) NOT NULL,
    [situacao] INT NOT NULL,
    [data_hora_sincronizacao] DATETIME2 NOT NULL CONSTRAINT [LeituraVeiculo_data_hora_sincronizacao_df] DEFAULT CURRENT_TIMESTAMP,
    [id_portaria] INT,
    [sentido] NVARCHAR(1000),
    [is_condutor] BIT NOT NULL CONSTRAINT [LeituraVeiculo_is_condutor_df] DEFAULT 1,
    CONSTRAINT [LeituraVeiculo_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[LeituraRFID] ADD CONSTRAINT [LeituraRFID_id_portaria_fkey] FOREIGN KEY ([id_portaria]) REFERENCES [dbo].[Portaria]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[LogOperacao] ADD CONSTRAINT [LogOperacao_id_usuario_fkey] FOREIGN KEY ([id_usuario]) REFERENCES [dbo].[Usuario]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[LeituraVeiculo] ADD CONSTRAINT [LeituraVeiculo_id_portaria_fkey] FOREIGN KEY ([id_portaria]) REFERENCES [dbo].[Portaria]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
