/**
 * Ícones padronizados — react-icons/lu (pacote Lucide).
 * Exceção de marca: WhatsApp permanece em react-icons/fa6 (`FaWhatsapp`).
 */
import type { IconType } from "react-icons";
import * as React from "react";
import { FaWhatsapp } from "react-icons/fa6";
import {
  LuActivity,
  LuArrowLeft,
  LuArrowRight,
  LuBell,
  LuCalendar,
  LuChartBar,
  LuChartLine,
  LuCheck,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuChevronUp,
  LuChevronsUpDown,
  LuCircle,
  LuCircleAlert,
  LuCircleCheck,
  LuCircleCheckBig,
  LuCircleHelp,
  LuCircleUser,
  LuCircleX,
  LuClock,
  LuCloud,
  LuCpu,
  LuDatabase,
  LuDot,
  LuDownload,
  LuEllipsis,
  LuExternalLink,
  LuEye,
  LuEyeOff,
  LuFileAudio,
  LuFileText,
  LuFilter,
  LuFolder,
  LuFolderOpen,
  LuFolderTree,
  LuForward,
  LuGripVertical,
  LuHardDrive,
  LuHouse,
  LuImage,
  LuInbox,
  LuInfo,
  LuLayoutDashboard,
  LuLink,
  LuLink2,
  LuLoaderCircle,
  LuLock,
  LuLogOut,
  LuMail,
  LuMenu,
  LuMessageCircle,
  LuPanelLeft,
  LuPlus,
  LuRefreshCw,
  LuRotateCcw,
  LuSave,
  LuScrollText,
  LuSearch,
  LuSend,
  LuServer,
  LuSettings,
  LuSettings2,
  LuShieldCheck,
  LuShieldHalf,
  LuShieldX,
  LuSmartphone,
  LuTimer,
  LuTrash2,
  LuTrendingUp,
  LuTriangleAlert,
  LuUser,
  LuUserCheck,
  LuUsers,
  LuVideo,
  LuWallet,
  LuWifi,
  LuX,
  LuZap,
} from "react-icons/lu";

export { FaWhatsapp };

/** Mesmo nome exportado para não quebrar imports; visual tipo “nuvem/Drive”. */
export const FaGoogleDrive = LuCloud;

export { LuX as HiXMark };

export type LucideIcon = IconType;

/** Separador OTP (ponto central) */
export function Dot(props: React.SVGProps<SVGSVGElement>) {
  return <LuDot className="h-1 w-1 shrink-0 opacity-50" {...props} />;
}

export const X = LuX;
export const Check = LuCheck;
export const ChevronDown = LuChevronDown;
export const ChevronLeft = LuChevronLeft;
export const ChevronRight = LuChevronRight;
export const ChevronUp = LuChevronUp;
export const ChevronsUpDown = LuChevronsUpDown;
export const Loader2 = LuLoaderCircle;
export const Search = LuSearch;
export const Eye = LuEye;
export const EyeOff = LuEyeOff;
export const MoreHorizontal = LuEllipsis;
export const Circle = LuCircle;
export const Inbox = LuInbox;
export const Server = LuServer;
export const CheckCircle = LuCircleCheck;
export const CheckCircle2 = LuCircleCheckBig;
export const XCircle = LuCircleX;
export const Shield = LuShieldHalf;
export const Users = LuUsers;
export const RefreshCw = LuRefreshCw;
export const Info = LuInfo;
export const Link = LuLink;
export const Link2 = LuLink2;
export const Image = LuImage;
export const Video = LuVideo;
export const FileAudio = LuFileAudio;
export const FileText = LuFileText;
export const Clock = LuClock;
export const HardDrive = LuHardDrive;
export const ArrowRight = LuArrowRight;
export const ArrowLeft = LuArrowLeft;
export const Cloud = LuCloud;
export const Mail = LuMail;
export const ShieldX = LuShieldX;
export const Send = LuSend;
export const UserCheck = LuUserCheck;
export const Activity = LuActivity;
export const AlertTriangle = LuTriangleAlert;
export const AlertCircle = LuCircleAlert;
export const Cpu = LuCpu;
export const Timer = LuTimer;
export const TrendingUp = LuTrendingUp;
export const ScrollText = LuScrollText;
export const Database = LuDatabase;
export const Lock = LuLock;
export const ExternalLink = LuExternalLink;
export const Settings = LuSettings;
export const Settings2 = LuSettings2;
export const LayoutDashboard = LuLayoutDashboard;
export const FolderOpen = LuFolderOpen;
export const Filter = LuFilter;
export const Download = LuDownload;
export const RotateCcw = LuRotateCcw;
export const PanelLeft = LuPanelLeft;
export const Bell = LuBell;
export const User = LuUser;
export const Menu = LuMenu;
export const Folder = LuFolder;
export const Forward = LuForward;
export const Trash2 = LuTrash2;
export const LogOut = LuLogOut;
export const HelpCircle = LuCircleHelp;
export const Save = LuSave;
export const GripVertical = LuGripVertical;
export const Plus = LuPlus;
export const MessageCircle = LuMessageCircle;
export const Zap = LuZap;
export const FolderTree = LuFolderTree;
export const Calendar = LuCalendar;
export const Wallet = LuWallet;
export const ArrowPath = LuRefreshCw;
export const ShieldCheck = LuShieldCheck;

export const DevicePhoneMobile = LuSmartphone;
export const ChartBarOutline = LuChartBar;
export const HomeOutline = LuHouse;
export const UserCircleOutline = LuCircleUser;
export const WifiOutline = LuWifi;
