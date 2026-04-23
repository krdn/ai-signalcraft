'use client';

import { useState } from 'react';
import { Calculator, TrendingDown, TrendingUp, Clock, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PLANS = {
  starter: { name: 'Starter', price: 49 },
  professional: { name: 'Professional', price: 129 },
  campaign: { name: 'Campaign', price: 249 },
};

export default function RoiCalculatorPage() {
  const [currentCost, setCurrentCost] = useState(300); // 현재 모니터링 비용 (만원)
  const [staffCount, setStaffCount] = useState(2); // 모니터링 인력 수
  const [hoursPerAnalysis, setHoursPerAnalysis] = useState(8); // 분석 1건당 소요 시간
  const [analysisPerMonth, setAnalysisPerMonth] = useState(4); // 월 분석 횟수

  // 음수/NaN 방지 헬퍼
  const clampPositive = (value: number, min = 0) => {
    const n = Number(value);
    return Number.isNaN(n) || n < min ? min : n;
  };

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'professional' | 'campaign'>(
    'professional',
  );

  const plan = PLANS[selectedPlan];

  // 계산 (음수/NaN 방지)
  const safeCost = clampPositive(currentCost);
  const safeStaff = clampPositive(staffCount);
  const safeHours = clampPositive(hoursPerAnalysis, 1);
  const safeAnalysis = clampPositive(analysisPerMonth, 1);

  // 계산
  const currentMonthlyTotal = safeCost; // 현재 월 비용
  const signalCraftCost = plan.price; // SignalCraft 비용
  const monthlySaving = currentMonthlyTotal - signalCraftCost;
  const yearlySaving = monthlySaving * 12;
  const savingPercent =
    currentMonthlyTotal > 0 ? Math.round((monthlySaving / currentMonthlyTotal) * 100) : 0;

  // 시간 절감
  const currentHoursPerMonth = safeHours * safeAnalysis;
  const signalCraftHoursPerMonth = safeAnalysis * 0.5; // 건당 30분 (트리거 + 확인)
  const savedHoursPerMonth = currentHoursPerMonth - signalCraftHoursPerMonth;

  // 인력 절감
  const staffSalaryPerPerson = 350; // 만원/월 (평균)
  const staffCostSaving = safeStaff > 1 ? Math.floor(safeStaff * 0.5) * staffSalaryPerPerson : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ROI 계산기</h1>
        <p className="text-muted-foreground">
          AI SignalCraft 도입 시 예상 비용 절감 효과를 계산해 보세요
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 입력 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              현재 운영 비용
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="roi-current-cost">현재 월 모니터링/분석 비용 (만원)</Label>
              <Input
                id="roi-current-cost"
                type="number"
                value={currentCost}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setCurrentCost(v);
                  setErrors((prev) => ({
                    ...prev,
                    currentCost: v < 0 ? '0 이상의 값을 입력하세요' : '',
                  }));
                }}
                min={0}
              />
              {errors.currentCost && (
                <p className="text-xs text-destructive mt-1">{errors.currentCost}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">인건비 + 도구 비용 포함</p>
            </div>
            <div>
              <Label htmlFor="roi-staff-count">모니터링/분석 인력 수</Label>
              <Input
                id="roi-staff-count"
                type="number"
                value={staffCount}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setStaffCount(v);
                  setErrors((prev) => ({
                    ...prev,
                    staffCount: v < 0 ? '0 이상의 값을 입력하세요' : '',
                  }));
                }}
                min={0}
              />
              {errors.staffCount && (
                <p className="text-xs text-destructive mt-1">{errors.staffCount}</p>
              )}
            </div>
            <div>
              <Label htmlFor="roi-hours">분석 1건당 소요 시간 (시간)</Label>
              <Input
                id="roi-hours"
                type="number"
                value={hoursPerAnalysis}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setHoursPerAnalysis(v);
                  setErrors((prev) => ({
                    ...prev,
                    hoursPerAnalysis: v < 1 ? '1 이상의 값을 입력하세요' : '',
                  }));
                }}
                min={1}
              />
              {errors.hoursPerAnalysis && (
                <p className="text-xs text-destructive mt-1">{errors.hoursPerAnalysis}</p>
              )}
            </div>
            <div>
              <Label htmlFor="roi-analysis-count">월 분석 횟수</Label>
              <Input
                id="roi-analysis-count"
                type="number"
                value={analysisPerMonth}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setAnalysisPerMonth(v);
                  setErrors((prev) => ({
                    ...prev,
                    analysisPerMonth: v < 1 ? '1 이상의 값을 입력하세요' : '',
                  }));
                }}
                min={1}
              />
              {errors.analysisPerMonth && (
                <p className="text-xs text-destructive mt-1">{errors.analysisPerMonth}</p>
              )}
            </div>
            <div>
              <Label htmlFor="roi-plan">SignalCraft 요금제</Label>
              <Select
                value={selectedPlan}
                onValueChange={(v) => v && setSelectedPlan(v as typeof selectedPlan)}
              >
                <SelectTrigger id="roi-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter (49만원/월)</SelectItem>
                  <SelectItem value="professional">Professional (129만원/월)</SelectItem>
                  <SelectItem value="campaign">Campaign (249만원/월)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 결과 */}
        <div className="space-y-4">
          {/* 비용 절감 */}
          <Card className={monthlySaving > 0 ? 'border-emerald-200 bg-emerald-50/50' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                {monthlySaving > 0 ? (
                  <TrendingDown className="h-4 w-4 text-emerald-600" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-amber-600" />
                )}
                비용 비교
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">현재 월 비용</span>
                  <span className="font-medium">{currentMonthlyTotal.toLocaleString()}만원</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">SignalCraft ({plan.name})</span>
                  <span className="font-medium text-primary">{signalCraftCost}만원</span>
                </div>
                <hr />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">월 절감액</span>
                  <span
                    className={`text-xl font-bold ${monthlySaving > 0 ? 'text-emerald-600' : 'text-amber-600'}`}
                  >
                    {monthlySaving > 0 ? '-' : '+'}
                    {Math.abs(monthlySaving).toLocaleString()}만원
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">연간 절감액</span>
                  <span className="font-medium">
                    {yearlySaving > 0 ? '-' : '+'}
                    {Math.abs(yearlySaving).toLocaleString()}만원
                  </span>
                </div>
                {savingPercent > 0 && (
                  <div className="text-center pt-2">
                    <span className="text-3xl font-bold text-emerald-600">{savingPercent}%</span>
                    <p className="text-xs text-muted-foreground">비용 절감</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 시간 절감 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                시간 절감
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">현재 월 소요 시간</span>
                  <span className="font-medium">{currentHoursPerMonth}시간</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">SignalCraft 소요 시간</span>
                  <span className="font-medium text-primary">{signalCraftHoursPerMonth}시간</span>
                </div>
                <hr />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">월 절감 시간</span>
                  <span className="text-xl font-bold text-emerald-600">
                    {savedHoursPerMonth.toFixed(1)}시간
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  * AI 자동 분석으로 수집~리포트 생성까지 자동화. 건당 약 30분 (트리거 + 결과 확인)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 인력 효율 */}
          {staffCount > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  인력 재배치 효과
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  현재 {staffCount}명의 인력 중{' '}
                  <span className="font-medium text-foreground">
                    약 {Math.max(Math.floor(staffCount * 0.5), 1)}명
                  </span>
                  을 다른 업무에 재배치할 수 있습니다.
                </p>
                {staffCostSaving > 0 && (
                  <p className="text-sm mt-2">
                    예상 인건비 절감:{' '}
                    <span className="font-bold text-emerald-600">
                      월 {staffCostSaving.toLocaleString()}만원
                    </span>
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
