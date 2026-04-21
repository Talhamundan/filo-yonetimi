import React from "react";
import { 
    ShieldCheck, 
    Sparkles, 
    CheckCircle2, 
    Fuel, 
    Wallet, 
    Car, 
    Users, 
    Search,
    LucideIcon,
    History,
    FileText,
    Building2,
    ArrowLeftRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExcelEntityKey } from "@/lib/excel-entities";

interface EmptyStateProps {
    entity?: ExcelEntityKey;
    title?: string;
    description?: string;
    className?: string;
}

interface StateConfig {
    icon: LucideIcon;
    title: string;
    description: string;
    colorClass: string;
    bgClass: string;
}

const CONFIG: Record<string, StateConfig> = {
    ceza: {
        icon: ShieldCheck,
        title: "Harika! Ceza Bulunmuyor",
        description: "Seçili dönemde filonuz hiç trafik cezası almadı. Güvenli sürüş için tüm ekibe teşekkürler!",
        colorClass: "text-emerald-600",
        bgClass: "bg-emerald-50",
    },
    ariza: {
        icon: Sparkles,
        title: "Mükemmel! Arıza Kaydı Yok",
        description: "Şu anda bildirilmiş herhangi bir arıza bulunmuyor. Araçlarınızın durumu gayet iyi görünüyor.",
        colorClass: "text-sky-600",
        bgClass: "bg-sky-50",
    },
    bakim: {
        icon: CheckCircle2,
        title: "Tertemiz! Servis Kaydı Yok",
        description: "Bu dönem için planlanmış veya bekleyen bir servis kaydı bulunamadı. Her şey zamanında yapılmış!",
        colorClass: "text-indigo-600",
        bgClass: "bg-indigo-50",
    },
    yakit: {
        icon: Fuel,
        title: "Yakıt Kaydı Henüz Girilmemiş",
        description: "Bu dönem için henüz bir yakıt girişi yapılmamış. Yeni kayıtları ekleyerek takibe başlayabilirsiniz.",
        colorClass: "text-orange-600",
        bgClass: "bg-orange-50",
    },
    masraf: {
        icon: Wallet,
        title: "Ek Masraf Bulunmuyor",
        description: "Seçili kriterlere uygun herhangi bir genel masraf kaydı bulunamadı.",
        colorClass: "text-slate-600",
        bgClass: "bg-slate-50",
    },
    arac: {
        icon: Car,
        title: "Henüz Araç Kaydı Yok",
        description: "Filonuzdaki araçları ekleyerek yönetmeye hemen başlayabilirsiniz.",
        colorClass: "text-slate-600",
        bgClass: "bg-slate-50",
    },
    personel: {
        icon: Users,
        title: "Personel Kaydı Bulunmuyor",
        description: "Sistemde henüz kayıtlı personel bulunmuyor. Yeni personel ekleyerek devam edebilirsiniz.",
        colorClass: "text-slate-600",
        bgClass: "bg-slate-50",
    },
    zimmet: {
        icon: ArrowLeftRight,
        title: "Zimmet Kaydı Yok",
        description: "Şu anda herhangi bir aktif zimmet veya teslimat kaydı bulunmuyor.",
        colorClass: "text-amber-600",
        bgClass: "bg-amber-50",
    },
    dokuman: {
        icon: FileText,
        title: "Belge Bulunamadı",
        description: "Bu bölüm için henüz herhangi bir doküman veya belge yüklenmemiş.",
        colorClass: "text-slate-600",
        bgClass: "bg-slate-50",
    },
    sirket: {
        icon: Building2,
        title: "Şirket Kaydı Yok",
        description: "Henüz bir şirket tanımı yapılmamış. Yeni bir şirket ekleyerek başlayabilirsiniz.",
        colorClass: "text-slate-600",
        bgClass: "bg-slate-50",
    },
    default: {
        icon: Search,
        title: "Kayıt Bulunamadı",
        description: "Aradığınız kriterlere uygun herhangi bir veri bulunamadı.",
        colorClass: "text-slate-400",
        bgClass: "bg-slate-50",
    }
};

export const EmptyState: React.FC<EmptyStateProps> = ({ 
    entity, 
    title, 
    description,
    className 
}) => {
    const config = (entity && CONFIG[entity]) || CONFIG.default;
    const Icon = config.icon;

    return (
        <div className={cn(
            "flex flex-col items-center justify-center py-12 px-4 text-center animate-in fade-in zoom-in duration-500",
            className
        )}>
            <div className={cn(
                "mb-5 flex h-20 w-20 items-center justify-center rounded-full shadow-inner",
                config.bgClass
            )}>
                <Icon className={cn("h-10 w-10", config.colorClass)} strokeWidth={1.5} />
            </div>
            
            <h3 className="mb-2 text-lg font-bold tracking-tight text-slate-900 text-center">
                {title || config.title}
            </h3>
            
            <p className="max-w-[320px] text-sm leading-relaxed text-slate-500 text-center">
                {description || config.description}
            </p>
        </div>
    );
};
