import { useState, useCallback, useRef } from "react";

// ─── STAGE DEFINITIONS ────────────────────────────────────────────────────────
const STAGES = {
  middleware: {
    id: "middleware", label: "Middleware", emoji: "⚙️", color: "#8B5CF6",
    sublabel: "Global → Module → Route",
    tagline: "Перший рубіж. До Nest DI.",
    description: "Найнижчий шар. Виконується до входу в Nest-екосистему — аналог Express middleware. Не знає про Guards чи Nest DI, але має повний доступ до req/res.",
    when: "Першим серед усіх шарів. До Guards, Interceptors, Pipes.",
    canDo: ["Модифікувати req і res об'єкти", "CORS, логування, rate limiting, парсинг тіла", "Завершити запит достроково", "Передати далі через next()"],
    cannotDo: ["Знати який Nest-роут/контролер викликається", "Нативно використовувати Nest DI"],
    warning: "⚠️ Помилки тут НЕ ловить Exception Filter!",
    code: `@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, url } = req;

    res.on('finish', () => {
      const ms = Date.now() - start;
      console.log(\`[\${method}] \${url} → \${res.statusCode} (\${ms}ms)\`);
    });

    next(); // ← без цього запит зависне назавжди
  }
}

// app.module.ts
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware, CorsMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}`,
  },
  guard: {
    id: "guard", label: "Guard", emoji: "🛡️", color: "#F59E0B",
    sublabel: "Global → Controller → Route",
    tagline: "Пустити чи ні. Єдине питання.",
    description: "Вирішує одне: чи має право цей запит виконатись? Аутентифікація, авторизація, перевірка ролей — все тут. Може читати метадані роуту через Reflector.",
    when: "Після Middleware, до Interceptors.",
    canDo: ["Перевірити JWT / session токен", "Перевірити роль / permissions юзера", "Читати @SetMetadata декоратори (Reflector)", "true → пустити; false/throw → заблокувати"],
    cannotDo: ["Модифікувати тіло запиту", "Трансформувати або перехопити відповідь"],
    code: `@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.get<boolean>(
      'isPublic', context.getHandler(),
    );
    if (isPublic) return true; // @Public() — пропустити

    const request = context.switchToHttp().getRequest();
    const [, token] = request.headers.authorization?.split(' ') ?? [];

    if (!token) throw new UnauthorizedException('Токен відсутній');

    try {
      request.user = this.jwtService.verify(token);
      return true; // ✅ пустити
    } catch {
      throw new UnauthorizedException('Невалідний токен'); // 🚫
    }
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Delete(':id')
remove(@Param('id') id: string) { ... }`,
  },
  interceptor_before: {
    id: "interceptor_before", label: "Interceptor", emoji: "🔄", color: "#10B981",
    sublabel: "↓ before — до Handler",
    tagline: "Код до next.handle(). Перехоплення на вході.",
    description: "Все що ти пишеш до next.handle() — виконується ДО хендлера. Може повернути кешовану відповідь, не викликаючи handler взагалі.",
    when: "Після Guards, до Pipes та Handler.",
    canDo: ["Трансформувати вхідні дані запиту", "Повернути кеш (handler не виклично!)", "Залогувати початок запиту + час", "Додати дані до execution context"],
    cannotDo: ["Блокувати запит як Guard (немає true/false рішення)"],
    code: `@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private cache = new Map<string, any>(); // замикання!

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const { url } = ctx.switchToHttp().getRequest();

    // ━━━ BEFORE: виконується ДО handler ━━━
    if (this.cache.has(url)) {
      console.log('Cache hit — handler пропущено!');
      return of(this.cache.get(url)); // ← handler не викликається
    }

    return next.handle().pipe(
      // ━━━ AFTER: виконується ПІСЛЯ handler ━━━
      tap(data => this.cache.set(url, data)),
    );
  }
}`,
  },
  pipe: {
    id: "pipe", label: "Pipe", emoji: "🔩", color: "#3B82F6",
    sublabel: "Global → Controller → Route → Param",
    tagline: "Валідація + Трансформація вхідних даних.",
    description: "Обробляє вхідні параметри безпосередньо перед хендлером: валідує структуру і/або перетворює типи. ValidationPipe, ParseIntPipe, ParseUUIDPipe — все це Pipes.",
    when: "Після Interceptors (before). Безпосередньо до Handler.",
    canDo: ["Валідувати DTO через class-validator", "Перетворювати: '42' → 42 (ParseIntPipe)", "Видаляти зайві поля (whitelist: true)", "Кидати BadRequestException при помилці"],
    cannotDo: ["Отримати доступ до req/res напряму", "Трансформувати або перехопити відповідь"],
    code: `// main.ts — глобально:
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,            // видалити невідомі поля
  forbidNonWhitelisted: true, // помилка на зайві поля
  transform: true,            // автоматично кастувати типи
}));

// DTO з class-validator:
export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @IsEmail()
  email: string;

  @IsInt()
  @Min(18)
  age: number;
}

// Кастомний Pipe:
@Injectable()
export class TrimPipe implements PipeTransform {
  transform(value: any): any {
    if (typeof value !== 'object' || !value) return value;
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k, typeof v === 'string' ? v.trim() : v
      ])
    );
  }
}`,
  },
  handler: {
    id: "handler", label: "Route Handler", emoji: "⭐", color: "#E0234E",
    sublabel: "Controller method",
    tagline: "Серце — тут твоя бізнес-логіка.",
    description: "Метод контролера — твій код. Сюди доходять тільки перевірені, авторизовані, трансформовані дані. Єдиний шар де пишеться бізнес-логіка застосунку.",
    when: "Після всіх Guards, Interceptors і Pipes.",
    canDo: ["Виконати бізнес-логіку застосунку", "Викликати сервіси та репозиторії", "Повернути дані або throw Exception", "Встановити кастомний HTTP статус-код"],
    cannotDo: [],
    code: `@Controller('users')
@UseGuards(JwtAuthGuard)
@UseInterceptors(LoggingInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query() query: PaginationDto): Promise<UserDto[]> {
    // Сюди дійшли тільки:
    // ✅ авторизовані (Guard перевірив JWT)
    // ✅ валідний query (Pipe валідував)
    return this.usersService.findAll(query);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    const user = await this.usersService.findOne(id);
    if (!user) throw new NotFoundException(\`User #\${id} not found\`);
    await this.usersService.remove(id);
  }
}`,
  },
  interceptor_after: {
    id: "interceptor_after", label: "Interceptor", emoji: "🔄", color: "#10B981",
    sublabel: "↑ after — після Handler",
    tagline: "Код в .pipe(). Трансформація відповіді.",
    description: "Та ж функція Interceptor, але тепер обробляє ВІДПОВІДЬ через RxJS .pipe(). Все що в next.handle().pipe() виконується після handler.",
    when: "Після Handler, до відправки Response клієнту.",
    canDo: ["Обгорнути у { data, meta, timestamp } формат", "Логувати час виконання запиту", "Перехопити помилку з handler (catchError)", "Кешувати результат для майбутніх запитів"],
    cannotDo: [],
    code: `@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const { url } = ctx.switchToHttp().getRequest();

    return next.handle().pipe(
      // Трансформувати успішну відповідь:
      map(data => ({
        success: true,
        data,
        meta: {
          timestamp: new Date().toISOString(),
          path: url,
          duration: \`\${Date.now() - start}ms\`,
        },
      })),

      // Перехопити помилку якщо потрібно:
      catchError(err => throwError(() => err)),
    );
  }
}

// Результат виглядатиме так:
// {
//   "success": true,
//   "data": { "id": 1, "name": "Олена" },
//   "meta": { "duration": "12ms", "path": "/users/1" }
// }`,
  },
  exception_filter: {
    id: "exception_filter", label: "Exception Filter", emoji: "🚨", color: "#EF4444",
    sublabel: "Route → Controller → Global",
    tagline: "Ловець усіх необроблених помилок.",
    description: "Ловить будь-які необроблені виключення від Guard до кінця Interceptors і перетворює їх на HTTP-відповідь з потрібним форматом. Виконується у зворотньому порядку від Guards.",
    when: "При будь-якому throw — від Guard до кінця Interceptors. Middleware НЕ покриває!",
    canDo: ["Перехопити будь-який Exception або конкретний тип", "Сформувати кастомний формат помилки", "Логувати в Sentry / Datadog / CloudWatch", "@Catch(NotFoundException) — фільтрувати по типу"],
    cannotDo: ["Перехопити помилки в Middleware"],
    warning: "⚠️ Помилки в Middleware НЕ ловить!",
    code: `@Catch() // без аргументів — ловить ВСЕ
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = 500;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse() as any;
      message = typeof res === 'string' ? res : res.message;
    }

    // Логувати тільки серверні помилки (5xx)
    if (statusCode >= 500) {
      this.logger.error(
        \`[ERROR] \${request.method} \${request.url}\`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

// main.ts
app.useGlobalFilters(new GlobalExceptionFilter());`,
  },
};

const PIPELINE_IDS = ["middleware","guard","interceptor_before","pipe","handler","interceptor_after"];
const FILTER_SCOPE = ["guard","interceptor_before","pipe","handler","interceptor_after"];

const SCENARIOS = [
  { id:"success",       label:"✅ Успіх",          color:"#10B981", bg:"rgba(16,185,129,.1)",  border:"rgba(16,185,129,.35)",  failAtId:null,          statusCode:"200 OK",           desc:"Пройшов всі шари успішно" },
  { id:"guard_fail",    label:"🛡️ Guard відмовив",  color:"#F59E0B", bg:"rgba(245,158,11,.1)",  border:"rgba(245,158,11,.35)",  failAtId:"guard",       statusCode:"401 Unauthorized", desc:"Guard кинув UnauthorizedException" },
  { id:"pipe_fail",     label:"🔩 Pipe помилка",    color:"#3B82F6", bg:"rgba(59,130,246,.1)",  border:"rgba(59,130,246,.35)",  failAtId:"pipe",        statusCode:"400 Bad Request",  desc:"Pipe кинув BadRequestException" },
  { id:"handler_error", label:"💥 Handler помилка", color:"#EF4444", bg:"rgba(239,68,68,.1)",   border:"rgba(239,68,68,.35)",   failAtId:"handler",     statusCode:"404 Not Found",    desc:"Handler кинув NotFoundException" },
];

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function NestLifecycle() {
  const [selectedId, setSelectedId] = useState("middleware");
  const [scenarioId, setScenarioId] = useState("success");
  const [statuses, setStatuses] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [result, setResult] = useState(null);
  const [filterCatching, setFilterCatching] = useState(false);
  const abortRef = useRef(false);

  const scenario = SCENARIOS.find(s => s.id === scenarioId);
  const selectedStage = STAGES[selectedId];

  const changeScenario = (id) => {
    if (isPlaying) return;
    setScenarioId(id); reset();
  };

  const reset = () => {
    abortRef.current = true;
    setStatuses({}); setResult(null);
    setFilterCatching(false); setIsPlaying(false);
  };

  const play = useCallback(() => {
    if (isPlaying) return;
    abortRef.current = false;
    setStatuses({}); setResult(null); setFilterCatching(false);
    setIsPlaying(true);

    let i = 0;
    const tick = () => {
      if (abortRef.current) return;
      if (i >= PIPELINE_IDS.length) {
        setResult({ ok: true });
        setIsPlaying(false);
        return;
      }
      const id = PIPELINE_IDS[i];
      setStatuses(p => ({ ...p, [id]: 'active' }));

      if (id === scenario.failAtId) {
        setTimeout(() => {
          if (abortRef.current) return;
          setStatuses(p => ({ ...p, [id]: 'failed' }));
          if (FILTER_SCOPE.includes(id)) {
            setTimeout(() => {
              if (abortRef.current) return;
              setFilterCatching(true);
              setResult({ ok: false });
              setIsPlaying(false);
            }, 480);
          } else {
            setResult({ ok: false });
            setIsPlaying(false);
          }
        }, 680);
        return;
      }
      setTimeout(() => {
        if (abortRef.current) return;
        setStatuses(p => ({ ...p, [id]: 'passed' }));
        i++;
        setTimeout(tick, 90);
      }, 680);
    };
    setTimeout(tick, 180);
  }, [isPlaying, scenario]);

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes ripple{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.6);opacity:0}}
        @keyframes filterPulse{
          0%{border-color:#EF4444;box-shadow:0 0 0 0 rgba(239,68,68,.5)}
          50%{border-color:#FCA5A5;box-shadow:0 0 0 6px rgba(239,68,68,0)}
          100%{border-color:#EF4444;box-shadow:0 0 0 0 rgba(239,68,68,.5)}
        }
        .pill{transition:border-color .2s,background .2s,box-shadow .2s}
        .pill:hover{filter:brightness(1.08)}
        .scn{transition:all .18s}
        .scn:hover{filter:brightness(1.1)}
        pre{tab-size:2}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-thumb{background:#30363D;border-radius:3px}
        ::-webkit-scrollbar-track{background:transparent}
      `}</style>

      <div style={{background:'#0D1117',minHeight:'100vh',color:'#E6EDF3',fontFamily:'system-ui,-apple-system,sans-serif',fontSize:14}}>

        {/* ── HEADER ─────────────────────────────────────────────── */}
        <div style={{padding:'13px 18px',borderBottom:'1px solid #21262D',background:'#0D1117'}}>
          <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:11}}>
            <div style={{width:26,height:26,borderRadius:7,background:'#E0234E',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:900,fontSize:14,letterSpacing:'-1px',flexShrink:0}}>N</div>
            <h1 style={{fontSize:16,fontWeight:700,color:'#E6EDF3',letterSpacing:'-.01em'}}>
              NestJS — Request Lifecycle
            </h1>
          </div>
          <div style={{display:'flex',gap:5,flexWrap:'wrap',alignItems:'center'}}>
            <span style={{fontSize:11,color:'#6B7280',marginRight:3}}>Сценарій:</span>
            {SCENARIOS.map(s => (
              <button key={s.id} className="scn" onClick={() => changeScenario(s.id)} style={{
                padding:'3px 11px',borderRadius:14,cursor:isPlaying?'default':'pointer',
                border:`1px solid ${s.id===scenarioId ? s.color : '#30363D'}`,
                background:s.id===scenarioId ? s.bg : 'transparent',
                color:s.id===scenarioId ? s.color : '#8B949E',
                fontSize:12,fontWeight:s.id===scenarioId?600:400,
                opacity:isPlaying?.65:1,
              }}>{s.label}</button>
            ))}
          </div>
        </div>

        {/* ── MAIN ───────────────────────────────────────────────── */}
        <div style={{display:'flex',flexWrap:'wrap'}}>

          {/* PIPELINE */}
          <div style={{width:290,minWidth:270,flexShrink:0,borderRight:'1px solid #21262D',padding:'16px 13px',overflowY:'auto',maxHeight:'calc(100vh - 90px)'}}>

            <EPBox emoji="🌐" label="HTTP Request" sub="incoming" />
            <Line />

            <StagePill s={STAGES.middleware} status={statuses.middleware} sel={selectedId==='middleware'} onClick={()=>setSelectedId('middleware')} />
            <Line />

            {/* ── EXCEPTION FILTER SCOPE ── */}
            <div style={{
              border:`1.5px dashed ${filterCatching ? '#EF4444' : '#2A3344'}`,
              borderRadius:10,padding:'10px 8px 8px',position:'relative',
              animation:filterCatching ? 'filterPulse .9s ease 5' : 'none',
              transition:'border-color .4s',
            }}>
              <button onClick={()=>setSelectedId('exception_filter')} style={{
                position:'absolute',top:-11,left:8,
                background:'#0D1117',
                border:`1px solid ${filterCatching?'#EF4444':selectedId==='exception_filter'?'#EF4444':'#30363D'}`,
                borderRadius:5,padding:'0 8px',height:20,
                display:'flex',alignItems:'center',gap:4,
                fontSize:11,fontFamily:'monospace',cursor:'pointer',
                color:filterCatching?'#EF4444':selectedId==='exception_filter'?'#F87171':'#6B7280',
                transition:'color .4s,border-color .4s',
              }}>
                🚨 Exception Filter
                {filterCatching && <span style={{color:'#FCA5A5',fontWeight:700}}> — ловить!</span>}
              </button>

              {FILTER_SCOPE.map((id,idx) => (
                <div key={id}>
                  {idx>0 && <Line />}
                  <StagePill s={STAGES[id]} status={statuses[id]} sel={selectedId===id} onClick={()=>setSelectedId(id)} />
                </div>
              ))}
            </div>

            <Line />
            <EPBox
              emoji={result ? (result.ok?'✅':'❌') : '📤'}
              label="HTTP Відповідь"
              sub={result ? `${scenario.statusCode}${result.ok?'':' ← Filter'}` : 'outgoing'}
              ok={result?.ok} err={result&&!result.ok}
            />

            {/* RESULT BADGE */}
            {result && (
              <div style={{
                marginTop:10,padding:'9px 12px',borderRadius:8,fontSize:12,
                background:result.ok?'rgba(16,185,129,.07)':'rgba(239,68,68,.07)',
                border:`1px solid ${result.ok?'rgba(16,185,129,.3)':'rgba(239,68,68,.3)'}`,
                color:result.ok?'#10B981':'#EF4444',
                display:'flex',alignItems:'center',gap:6,
              }}>
                <span style={{fontWeight:700}}>{scenario.statusCode}</span>
                <span style={{color:result.ok?'#6EE7B7':'#FCA5A5',fontSize:11}}>{scenario.desc}</span>
              </div>
            )}

            {/* PLAY / RESET */}
            <div style={{display:'flex',gap:7,marginTop:14}}>
              <button onClick={play} disabled={isPlaying} style={{
                flex:1,padding:'9px 0',borderRadius:8,border:'none',
                background:isPlaying?'#161B22':'#E0234E',
                color:isPlaying?'#6B7280':'white',
                cursor:isPlaying?'default':'pointer',
                fontSize:13,fontWeight:600,
                display:'flex',alignItems:'center',justifyContent:'center',gap:6,
              }}>
                {isPlaying && <div style={{width:12,height:12,border:'2px solid #4B5563',borderTopColor:'transparent',borderRadius:'50%',animation:'spin .7s linear infinite'}} />}
                {isPlaying ? 'Виконується...' : '▶  Симулювати'}
              </button>
              <button onClick={reset} style={{
                padding:'9px 12px',borderRadius:8,
                border:'1px solid #30363D',background:'transparent',
                color:'#8B949E',cursor:'pointer',fontSize:16,
              }} title="Скинути">↺</button>
            </div>
          </div>

          {/* DETAIL PANEL */}
          <div style={{flex:1,minWidth:280,padding:'18px 20px',overflowY:'auto',maxHeight:'calc(100vh - 90px)'}}>
            {selectedStage ? <Detail stage={selectedStage} /> : (
              <div style={{color:'#6B7280',textAlign:'center',paddingTop:60,fontSize:13}}>
                Натисни на шар у pipeline, щоб побачити деталі
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── PIPELINE HELPERS ────────────────────────────────────────────────────────
function Line() {
  return <div style={{width:2,height:13,background:'#1C2333',margin:'2px auto'}} />;
}

function EPBox({ emoji, label, sub, ok, err }) {
  return (
    <div style={{
      display:'flex',alignItems:'center',gap:9,padding:'8px 11px',borderRadius:8,
      background:ok?'rgba(16,185,129,.07)':err?'rgba(239,68,68,.07)':'#161B22',
      border:`1px solid ${ok?'rgba(16,185,129,.25)':err?'rgba(239,68,68,.25)':'#21262D'}`,
    }}>
      <span style={{fontSize:18}}>{emoji}</span>
      <div>
        <div style={{fontSize:13,fontWeight:600,color:'#E6EDF3'}}>{label}</div>
        <div style={{fontSize:10,marginTop:1,fontFamily:'monospace',color:ok?'#10B981':err?'#EF4444':'#6B7280'}}>{sub}</div>
      </div>
    </div>
  );
}

function StagePill({ s, status, sel, onClick }) {
  const active = status==='active', passed = status==='passed', failed = status==='failed';
  return (
    <div className="pill" onClick={onClick} style={{
      padding:'8px 10px',borderRadius:8,cursor:'pointer',
      position:'relative',overflow:'hidden',
      border:`1.5px solid ${failed?'rgba(239,68,68,.45)':active?s.color:sel?s.color+'70':'#1C2333'}`,
      background:failed?'rgba(239,68,68,.06)':active?`${s.color}1a`:sel?`${s.color}0e`:'#161B22',
      boxShadow:active?`0 0 10px ${s.color}2e`:failed?'0 0 8px rgba(239,68,68,.18)':'none',
    }}>
      <div style={{position:'absolute',left:0,top:0,bottom:0,width:3,background:failed?'#EF4444':s.color,borderRadius:'8px 0 0 8px'}} />
      <div style={{paddingLeft:8,display:'flex',alignItems:'center',justifyContent:'space-between',gap:6}}>
        <div style={{display:'flex',alignItems:'center',gap:6,minWidth:0}}>
          <span style={{fontSize:14,flexShrink:0}}>{s.emoji}</span>
          <div style={{minWidth:0}}>
            <div style={{fontSize:13,fontWeight:600,lineHeight:1.2,color:failed?'#EF4444':active?s.color:sel?s.color:'#CDD9E5',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.label}</div>
            <div style={{fontSize:10,color:'#6B7280',fontFamily:'monospace',marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.sublabel}</div>
          </div>
        </div>
        <StatusIcon status={status} color={s.color} />
      </div>
    </div>
  );
}

function StatusIcon({ status, color }) {
  if (status==='passed') return <span style={{color:'#10B981',fontSize:12,flexShrink:0,fontWeight:700}}>✓</span>;
  if (status==='failed') return <span style={{color:'#EF4444',fontSize:13,flexShrink:0,fontWeight:700}}>✗</span>;
  if (status==='active') return (
    <div style={{position:'relative',width:10,height:10,flexShrink:0}}>
      <div style={{position:'absolute',inset:0,borderRadius:'50%',background:color,animation:'ripple .9s ease-out infinite',opacity:.6}} />
      <div style={{position:'absolute',inset:'2px',borderRadius:'50%',background:color}} />
    </div>
  );
  return null;
}

// ─── DETAIL PANEL ────────────────────────────────────────────────────────────
function Detail({ stage }) {
  return (
    <div>
      {/* Header card */}
      <div style={{
        padding:'16px 18px',borderRadius:12,marginBottom:16,
        border:`1px solid ${stage.color}28`,
        background:`linear-gradient(135deg,${stage.color}0c 0%,transparent 60%)`,
      }}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
          <span style={{fontSize:30,flexShrink:0}}>{stage.emoji}</span>
          <div>
            <h2 style={{fontSize:20,fontWeight:700,color:stage.color,lineHeight:1.1}}>{stage.label}</h2>
            <div style={{fontSize:11,color:'#6B7280',fontFamily:'monospace',marginTop:3}}>{stage.sublabel}</div>
          </div>
        </div>
        <p style={{fontSize:13,color:'#8B949E',fontStyle:'italic',lineHeight:1.5}}>{stage.tagline}</p>
      </div>

      <p style={{fontSize:14,color:'#CDD9E5',lineHeight:1.75,marginBottom:16}}>{stage.description}</p>

      {stage.when && <Sect title="⏱  Коли виконується"><p style={{fontSize:13,color:'#E6EDF3',lineHeight:1.6}}>{stage.when}</p></Sect>}

      {stage.canDo?.length>0 && (
        <Sect title="✅  Може">
          {stage.canDo.map((t,i) => <Li key={i} color="#10B981" mark="✓">{t}</Li>)}
        </Sect>
      )}
      {stage.cannotDo?.length>0 && (
        <Sect title="🚫  Не може">
          {stage.cannotDo.map((t,i) => <Li key={i} color="#EF4444" mark="✗">{t}</Li>)}
        </Sect>
      )}

      {stage.warning && (
        <div style={{margin:'4px 0 14px',padding:'10px 14px',borderRadius:8,fontSize:13,color:'#FCA5A5',background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.22)'}}>
          {stage.warning}
        </div>
      )}

      {stage.code && (
        <div style={{marginTop:16}}>
          <div style={{fontSize:11,fontWeight:600,color:'#8B949E',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>Приклад коду</div>
          <pre style={{margin:0,padding:'14px 16px',borderRadius:10,background:'#010409',border:'1px solid #1C2333',fontSize:12,lineHeight:1.65,color:'#CDD9E5',fontFamily:"'Cascadia Code','Fira Code','JetBrains Mono',monospace",overflowX:'auto',whiteSpace:'pre'}}>{stage.code}</pre>
        </div>
      )}
    </div>
  );
}

function Sect({ title, children }) {
  return (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:11,fontWeight:600,color:'#8B949E',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:7}}>{title}</div>
      {children}
    </div>
  );
}

function Li({ children, color, mark }) {
  return (
    <div style={{display:'flex',alignItems:'flex-start',gap:7,marginBottom:5,fontSize:13,color:'#CDD9E5',lineHeight:1.55}}>
      <span style={{color,flexShrink:0,fontWeight:700,marginTop:1}}>{mark}</span>
      {children}
    </div>
  );
}