/**
 * GULPFILE.JS:
 * 
 * Gulp di default per il deploy di progetti futuri.
 * 
 * @author Cyril Dally
 * @data: 2015-09-23
 */
var gulp = require('gulp');
var os = require('os');
var gulpif = require('gulp-if');
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');
var minify = require('gulp-minify-css');
var minimist = require('minimist');
var del = require('del');
var fs = require('fs');
var rsync = require('gulp-rsync');
var git = require('gulp-git');
var rename = require('gulp-rename');
var sass = require('gulp-sass');
var exec = require('gulp-exec');
var shell = require('gulp-shell');
var mkdirp = require('mkdirp');


/**
 * Solo la macchina specificata in authHostname è autorizzata ad effettuare i deploy
 * 
 * @author Cyril Dally
 * @data: 2015-09-25
 */
var authHostname = "cdf-pc"; // var authHostname = "TRLIVEBUILDER";
var hostname = os.hostname();
if( hostname != authHostname ) {
  throw "NON SEI SULLA MACCHINA PONTE!\nhostname = " + hostname;
}


/**
 * Task "install" (Prima installazione):
 *
 * La prima volta che si intende installare il progetto bisogna comunque lanciare il comando "npm install" a mano nel terminale della macchina, prima di lanciare il task "firstinstall".
 * Il task "firstinstall" lancierà i seguenti task: "install", "check", "compile".
 * Lanciando il task "install" Gulp installerà le dependencies di composer e bower laddove esistenti.
 * 
 * @author Cyril Dally
 * @data: 2015-09-25
 */
gulp.task( 'install', function() {

  return gulp.src('/')
    .pipe( gulpif( fs.statSync('composer.json').isFile(), exec('composer install') ) )
    .pipe( gulpif( fs.statSync('bower.json').isFile(), exec('bower install') ) );

});


/**
 * Task "config" (Controlli e configurazione):
 *
 * Il task recupera le opzioni passate e verifica la coerenza:
 * Se "env" non è definito, sarà valorizzato a "staging" e si potrà deployare qualsiasi branch.
 * Invece se è definito come "prod", si potrà deployare solo dal branch master (sarà sovvrascritto se diverso).
 *
 * Se l'opzione debug è definita lo script stamperà vari messaggi di controllo durante la propria esecuzione.
 * Se l'opzione nodry è definita lo script effettuerà veramente il deploy, altrimenti effetterà solo un test.
 *
 * path, owner e group sono definiti direttamente nello script e diversi in base all'env di deploy
 *
 * --env: string, valori possibili: staging | prod, default: staging
 * --branch: string, valori possibili: develop | master | qualsiasi branch esistenti su Git, default: develop
 * --debug: boolean, valori possibili: void (indicare solo --debug), default: false
 * --nodry: boolean, valori possibili: void (indicare solo --debug), default: false
 * 
 * @author Cyril Dally
 * @data: 2015-09-25
 */
gulp.task( 'config', function() {

  // Recupera le opzioni
  var options = minimist( process.argv.slice( 2 ) );

  // Se non specificato l'env viene settato su staging
  env = undefined == options.env ? 'staging' : options.env;

  // Se non specificato il branch viene settato su develop
  branch = undefined == options.branch ? 'develop' : options.branch;

  if( env == 'prod' && branch != 'master' ) {
    throw "NON PUOI DEPLOYARE IN PRODUZIONE DA QUESTO BRANCH!\nenv = " + env + "\nbranch = " + branch;
  }

  // Se non specificato il debug viene settato su false
  debug = undefined == options.debug ? false : true;

  // Se non specificato il nodry viene settato su false
  nodry = undefined == options.nodry ? false : true;

  // Di default il disco di destinazione è settato su quello di dev
  // Non è un'opzione modificabile
  path = '/home/cdf/gitProjects/deploy/dev/';

  owner = 'pinco';
  group = 'pallino';

  // Se deployiamo in prod, sovvrascriviamo queste variabili
  if( env == "prod" ) {
    branch = 'master';
    path = '/home/cdf/gitProjects/deploy/prod/';
    owner = 'pinca';
    group = 'pallina';
  }

  if( debug ) {
    console.log( "Task config: hostname = " + hostname );
    console.log( "Task config: env = " + env );
    console.log( "Task config: branch = " + branch );
    console.log( "Task config: path = " + path );
    console.log( "Task config: nodry = " + nodry );
  }
});


/**
 * Task "git" (Controlli e comandi Git):
 *
 * Il task "git" effettua i seguenti passaggi:
 * - checkout sul branch corretto
 * - pull del branch corretto
 * 
 * @author Cyril Dally
 * @data: 2015-09-25
 */
gulp.task('git', ['config'], function() {

  if( debug ) {
    console.log( "Task git: branch = " + branch );
  }

  // PRIMA DOVREBBE FARE UN RESET HEAD DI EVENTUALI COMMIT RIMASTI APPESI SULLA MACCHINA
  // git.reset('HEAD', {args:'--hard'}, function (err) {
  //   if (err) throw err;
  // });

  git.checkout(branch, {}, function (err) {
    if (err) throw err;
  });

  git.pull('origin', branch, {}, function (err) {
    if (err) throw err;
  });
});


/**
 * Task "clean":
 *
 * Il task "clean" pulisce le cartelle "css" e "js"  nella cartella "source" prima di compilarli di nuovo 
 * 
 * @author Cyril Dally
 * @data: 2015-09-25
 */
gulp.task( 'clean', ['check'], function () {
  return del([ 'source/css/*' ]);
});


/**
 * Task "sass":
 *
 * Il task "sass" compila i sass e crea i css nella cartella "source/css/" 
 * I file css creati non sono minimizzati né rinomati.
 * 
 * @author Cyril Dally
 * @data: 2015-09-25
 */
gulp.task( 'sass', ['clean'], function() {

  if( debug ) {
    console.log( "Task sass: env = " + env );
  }

  'use strict';

  return gulp.src('source/sass/**/*.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest('source/css'));
});


/**
 * Task "cssmin":
 *
 * Il task "cssmin" compila i css definitivi nella cartella "public/css/" 
 * I file css creati sono minimizzati e rinomati (.min).
 * 
 * @author Cyril Dally
 * @data: 2015-09-25
 */
gulp.task( 'cssmin', ['sass'], function() {

  if( debug ) {
    console.log( "Task cssmin: env = " + env );
  }

  del([ 'public/css/*' ]);

  return gulp.src( 'source/css/*.css' )
    .pipe(minify())
    .pipe(rename(function (path) {
      path.dirname += "";
      path.basename += ".min";
      path.extname = ".css"
    }))
    .pipe(gulp.dest('public/css/'));
});


/**
 * Task "jsmin":
 *
 * Il task "jsmin" compila i js definitivi nella cartella "public/js/" 
 * Crea un unico file js concatenato, minimizzato e rinomato (.min)
 * 
 * @author Cyril Dally
 * @data: 2015-09-25
 */
gulp.task( 'jsmin', ['clean'], function() {

  if( debug ) {
    console.log( "Task jsmin: env = " + env );
  }

  del([ 'public/js/*' ]);

  return gulp.src( 'source/js/*.js' )
    .pipe(concat( "js.min.js" ))
    .pipe(uglify())
    .pipe(gulp.dest('public/js/'));
});


/**
 * Task "sync":
 *
 * Il task "sync" effettua il remote sync del contenuto della cartella "public/" verso la macchina scelta.
 * Se l'opzione --nodry è stata inserita, il deploy sarà effettivamente realizzato, altrimenti lo script effettuerà solo un test.
 *
 * Prima di fare il deploy dei file crea il file ".env" in base all'env definito nelle opzioni.
 * Dopo aver effettuato la rsync, lo script lancia un comando per attribuire i giusti permessi alle cartelle così create.
 * 
 * @author Cyril Dally
 * @data: 2015-09-25
 */
gulp.task('sync', ['compile'], function() {

  // Crea il file .env con i parametri giusti in base al deploy in atto
  var srcEnv = '.env.' + env;
  if( !fs.existsSync(srcEnv) ){
    throw srcEnv + " DOES NOT EXIST";
  } else {
    fs.createReadStream(srcEnv).pipe( fs.createWriteStream('.env') );
  }

  if( debug ) {
    console.log( "Task sync: creato file .env." + env );
  }

  // Tutti i file/cartelle da NON deployare
  var file = '';
  var rsyncExcludeList = 'rsync-excludelist';
  if( fs.existsSync(rsyncExcludeList) ){
    file = fs.readFileSync(rsyncExcludeList, "utf8")
  }
  var arr = file.split("\n");

  if( debug ) {
    console.log( "Task sync: arr = " + arr );
  }

  if( nodry ) {
    if( !fs.existsSync(path) ) {
      if( !mkdirp.sync( path, '0755') ) {
        if (err) throw "CANNOT CREATE DIRECTORY: " + path;
      }
    }

    if( debug ) {
      console.log( "Task sync: path = " + path );
    }

    gulp.src( process.cwd() )
      .pipe( rsync( {
        recursive: true,
        destination: path,
        progress: true,
        incremental: true,
        exclude: arr,
        emptyDirectories: true,
        compress: true,
        clean: true // Pulisce le cartelle di destinazione man mano che va avanti l'rsync
      } )
    );

    shell.task([
      'cd ' + path,
      'chown -R ' + owner + ':' + group
      ]);
  }

});

// Defined tasks
gulp.task( 'firstinstall', [ 'install', 'check', 'compile' ] );
gulp.task( 'check', [ 'config', 'git' ] );
gulp.task( 'compile', [ 'check', 'clean', 'sass', 'cssmin', 'jsmin' ] );
gulp.task( 'deploy', [ 'compile', 'sync' ] );