/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import {
  formatDateVN,
  formatTimeVN,
  formatDayOfWeekVN,
  formatIsoDate,
  getDutyShiftDateForTimestamp,
  getHandoverStatus,
  getDefaultScheduleRange,
} from '../services/dateTimeUtils';

export function useRealTimeClock() {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    // Cập nhật đều đặn mỗi 1000ms
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    // Khi người dùng chuyển tab hoặc máy tính wake up, đồng bộ tức thì
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setNow(new Date());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const formattedTime = formatTimeVN(now);
  const formattedDayOfWeek = formatDayOfWeekVN(now);
  const formattedDateShort = formatDateVN(now);
  const formattedDateFull = `${formattedDayOfWeek}, ${formattedDateShort}`;
  const todayDate = formatIsoDate(now);
  const currentDutyDate = getDutyShiftDateForTimestamp(now);
  const handoverStatus = getHandoverStatus(now);
  const defaultScheduleRange = getDefaultScheduleRange(now);

  return {
    now,
    formattedTime,
    formattedDayOfWeek,
    formattedDateShort,
    formattedDateFull,
    todayDate,
    currentDutyDate,
    handoverStatus,
    defaultScheduleRange,
  };
}
