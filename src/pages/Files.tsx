import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, FileAudio, FileText, FolderOpen, Image, Loader2, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface FolderStats {
  icon: typeof Image;
  name: string;
  count: number;
  color: string;
  bgColor: string;
}

export default function Files() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [folderStats, setFolderStats] = useState<FolderStats[]>([
    { icon: Image, name: "Imagens", count: 0, color: "text-blue-500", bgColor: "bg-blue-500/10" },
    { icon: Video, name: "Vídeos", count: 0, color: "text-purple-500", bgColor: "bg-purple-500/10" },
    { icon: FileAudio, name: "Áudios", count: 0, color: "text-orange-500", bgColor: "bg-orange-500/10" },
    { icon: FileText, name: "Documentos", count: 0, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  ]);
  const [rootFolder, setRootFolder] = useState("/SwiftWapDrive");
  const [googleDriveUrl, setGoogleDriveUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadFiles = async () => {
      setIsLoading(true);
      try {
        // Buscar contagem de arquivos por tipo
        const { data: filesData, error: filesError } = await supabase
          .from('media_files')
          .select('media_type')
          .eq('user_id', user.id)
          .eq('sync_status', 'completed');

        if (filesError) throw filesError;

        // Contar por tipo
        const counts = {
          image: filesData?.filter(f => f.media_type === 'image').length || 0,
          video: filesData?.filter(f => f.media_type === 'video').length || 0,
          audio: filesData?.filter(f => f.media_type === 'audio').length || 0,
          document: filesData?.filter(f => f.media_type === 'document').length || 0,
        };

        setFolderStats([
          { icon: Image, name: "Imagens", count: counts.image, color: "text-blue-500", bgColor: "bg-blue-500/10" },
          { icon: Video, name: "Vídeos", count: counts.video, color: "text-purple-500", bgColor: "bg-purple-500/10" },
          { icon: FileAudio, name: "Áudios", count: counts.audio, color: "text-orange-500", bgColor: "bg-orange-500/10" },
          { icon: FileText, name: "Documentos", count: counts.document, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
        ]);

        // Buscar configuração da pasta raiz
        const { data: connection } = await supabase
          .from('connections')
          .select('google_root_folder')
          .eq('user_id', user.id)
          .maybeSingle();

        if (connection?.google_root_folder) {
          setRootFolder(connection.google_root_folder);
        }

        // Buscar URL da pasta raiz do Google Drive
        // Estratégia 1: usar root_folder_id da conta Google Drive conectada
        const { data: googleAccount } = await supabase
          .from('google_drive_accounts')
          .select('root_folder_id, root_folder_path')
          .eq('user_id', user.id)
          .eq('status', 'connected')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (googleAccount?.root_folder_id) {
          setGoogleDriveUrl(`https://drive.google.com/drive/folders/${googleAccount.root_folder_id}`);
        } else {
          // Estratégia 2: pegar google_drive_folder_id de um arquivo processado
          const { data: firstFile } = await supabase
            .from('media_files')
            .select('google_drive_folder_id, google_drive_url')
            .eq('user_id', user.id)
            .eq('sync_status', 'completed')
            .not('google_drive_folder_id', 'is', null)
            .order('processed_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (firstFile?.google_drive_folder_id) {
            setGoogleDriveUrl(`https://drive.google.com/drive/folders/${firstFile.google_drive_folder_id}`);
          } else if (firstFile?.google_drive_url) {
            // Estratégia 3 (fallback): tentar extrair da URL do arquivo
            // URL de arquivo: https://drive.google.com/file/d/{fileId}/view
            // Não temos o folderId direto aqui, então abrimos o arquivo no Drive
            setGoogleDriveUrl(firstFile.google_drive_url);
          }
        }
      } catch (error) {
        console.error('Error loading files:', error);
        toast.error("Erro ao carregar arquivos");
      } finally {
        setIsLoading(false);
      }
    };

    loadFiles();
  }, [user]);

  const handleOpenDrive = () => {
    if (googleDriveUrl) {
      window.open(googleDriveUrl, '_blank');
    } else {
      toast.info("Nenhum arquivo sincronizado ainda. Os arquivos aparecerão aqui após serem processados.");
    }
  };

  const totalFiles = folderStats.reduce((sum, folder) => sum + folder.count, 0);

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Arquivos
          </h1>
          <p className="text-muted-foreground">
            Visualize a estrutura de arquivos sincronizados
          </p>
        </div>
        <Button variant="outline" onClick={handleOpenDrive} disabled={!googleDriveUrl}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Abrir no Drive
        </Button>
      </div>

      {/* Root Folder */}
      <Card className="mb-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{rootFolder}</CardTitle>
              <CardDescription>
                {totalFiles > 0 
                  ? `${totalFiles} arquivo${totalFiles !== 1 ? 's' : ''} sincronizado${totalFiles !== 1 ? 's' : ''}`
                  : 'Pasta raiz configurada'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Subfolders */}
      {isLoading ? (
        <Card className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          <CardContent className="p-12">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-muted-foreground">Carregando arquivos...</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="grid gap-4 sm:min-w-0 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in" style={{ animationDelay: '200ms' }}>
            {folderStats.map((folder) => (
              <Card key={folder.name} className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${folder.bgColor}`}>
                      <folder.icon className={`h-6 w-6 ${folder.color}`} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{folder.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {folder.count} arquivo{folder.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <Card className="mt-6 animate-fade-in" style={{ animationDelay: '300ms' }}>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            Os arquivos são organizados automaticamente em subpastas por tipo e data. 
            Para alterar a estrutura de pastas, acesse as <a href="/settings" className="text-primary hover:underline">Configurações</a>.
          </p>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
