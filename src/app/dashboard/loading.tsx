import { Skeleton } from "../../components/ui/skeleton";

export default function DashboardLoading() {
    return (
        <div className="p-6 md:p-8 xl:p-10">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <Skeleton className="h-8 w-64 mb-2" />
                    <Skeleton className="h-4 w-96" />
                </div>
                <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-32" />
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm space-y-3">
                        <div className="flex justify-between">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-8 rounded-md" />
                        </div>
                        <Skeleton className="h-8 w-32" />
                        <Skeleton className="h-3 w-40" />
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="col-span-1 lg:col-span-2 border border-slate-200 rounded-xl p-6 bg-white shadow-sm h-[350px] flex flex-col">
                    <Skeleton className="h-5 w-48 mb-6" />
                    <Skeleton className="flex-1 w-full" />
                </div>
                <div className="col-span-1 border border-slate-200 rounded-xl p-6 bg-white shadow-sm h-[350px] flex flex-col">
                    <Skeleton className="h-5 w-32 mb-6" />
                    <div className="flex-1 flex justify-center items-center">
                        <Skeleton className="h-40 w-40 rounded-full" />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                    </div>
                </div>
            </div>
        </div>
    );
}
