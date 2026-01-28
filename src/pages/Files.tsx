import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderOpen, Image, Video, FileAudio, FileText, ExternalLink } from "lucide-react";

const folderStructure = [
  { icon: Image, name: "Imagens", count: 856, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  { icon: Video, name: "Vídeos", count: 234, color: "text-purple-500", bgColor: "bg-purple-500/10" },
  { icon: FileAudio, name: "Áudios", count: 89, color: "text-orange-500", bgColor: "bg-orange-500/10" },
  { icon: FileText, name: "Documentos", count: 68, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
];

export default function Files() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar currentPath="/files" />

      <main className="pl-16 lg:pl-64 pt-16 transition-all duration-300">
        <div className="container py-8">
          {/* Page Header */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Arquivos
              </h1>
              <p className="text-muted-foreground">
                Visualize a estrutura de pastas no Google Drive
              </p>
            </div>
            <Button variant="outline">
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir no Drive
            </Button>
          </div>

          {/* Root Folder */}
          <Card className="mb-6">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FolderOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">/WhatsApp Uploads</CardTitle>
                  <CardDescription>Pasta raiz configurada</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Subfolders */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {folderStructure.map((folder) => (
              <Card key={folder.name} className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${folder.bgColor}`}>
                      <folder.icon className={`h-6 w-6 ${folder.color}`} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{folder.name}</p>
                      <p className="text-sm text-muted-foreground">{folder.count} arquivos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Info */}
          <Card className="mt-6">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                Os arquivos são organizados automaticamente em subpastas por tipo e data. 
                Para alterar a estrutura de pastas, acesse as <a href="/settings" className="text-primary hover:underline">Configurações</a>.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
