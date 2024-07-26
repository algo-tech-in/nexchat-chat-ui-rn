export const isSameDate = (dateOne: string, dateTwo: string) => {
  const date1 = new Date(dateOne);
  const date2 = new Date(dateTwo);
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};
